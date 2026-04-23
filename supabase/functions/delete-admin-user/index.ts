import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing env", { hasUrl: !!supabaseUrl, hasAnon: !!anonKey, hasService: !!serviceRoleKey });
      return json(500, { error: "Server configuration error" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization header" });

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json(401, { error: "Invalid or expired session" });
    }
    const caller = callerData.user;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRole, error: callerRoleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (callerRoleErr) {
      console.error("Caller role lookup failed", callerRoleErr);
      return json(403, { error: "Caller has no role assigned" });
    }
    if (!callerRole) return json(403, { error: "Caller has no role assigned" });
    if (callerRole.role !== "admin") {
      return json(403, { error: "Only Super Admin can delete users" });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const userId = (body.user_id ?? body.targetUserId) as string | undefined;
    if (!userId || typeof userId !== "string") {
      return json(400, { error: "user_id is required" });
    }
    if (userId === caller.id) {
      return json(400, { error: "Cannot delete your own account" });
    }

    // Verify target exists
    const { data: targetUserData, error: targetErr } = await adminClient.auth.admin.getUserById(userId);
    if (targetErr || !targetUserData?.user) {
      return json(404, { error: "User not found" });
    }

    // Last admin guard
    const { data: targetRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetRole?.role === "admin") {
      const { count, error: countErr } = await adminClient
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (countErr) {
        console.error("Admin count failed", countErr);
        return json(500, { error: "Failed to verify admin count" });
      }
      if ((count ?? 0) <= 1) {
        return json(409, { error: "Cannot delete the last Super Admin" });
      }
    }

    // Idempotent role cleanup
    const { error: roleDelErr } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (roleDelErr) {
      console.error("Role delete failed", roleDelErr);
      // continue — auth delete may still succeed; surface error if it doesn't
    }

    // Delete auth user
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authDelErr) {
      console.error("Auth delete failed", authDelErr);
      return json(409, { error: `Cannot delete: ${authDelErr.message}` });
    }

    return json(200, { success: true, deleted_user_id: userId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected error", message);
    return json(500, { error: message });
  }
});
