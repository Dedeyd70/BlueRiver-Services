import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves admin display names for activity logs.
 *
 * Uses the SECURITY DEFINER RPC `get_admin_display_names`, which is callable
 * by ANY authenticated user (Manager / Staff included). This replaces the
 * legacy `list-admin-users` edge-function path that only worked for Super
 * Admins, so non-admin staff now see real actor names in audit trails.
 */
export const useAdminUserNames = () => {
  return useQuery({
    queryKey: ["admin-user-name-map"],
    queryFn: async (): Promise<Record<string, string>> => {
      try {
        // Pull every actor we currently reference (bookings, quotes, invoices).
        // The RPC accepts an array of UUIDs; we pass the union of distinct
        // actor_ids/created_by from the relevant tables we need to label.
        // Since fetching the full set of UUIDs upfront would require N joins,
        // we ask the RPC for "all admin-ish users" by passing every user_id
        // present in user_roles — that's the universe of possible actors.
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id");
        const ids = Array.from(
          new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean))
        );
        if (ids.length === 0) return {};
        const { data, error } = await (supabase as any).rpc(
          "get_admin_display_names",
          { _user_ids: ids }
        );
        if (error) throw error;
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: any) => {
          if (r?.user_id) map[r.user_id] = r.display_name || "Admin user";
        });
        return map;
      } catch {
        return {};
      }
    },
    staleTime: 5 * 60 * 1000,
  });
};
