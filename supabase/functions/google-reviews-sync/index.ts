import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const DIRECT_URL = "https://places.googleapis.com";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Fetch place details. The stored GOOGLE_MAPS_API_KEY may either be a Lovable
 * connector key (used through the gateway) or the owner's own Google key. Try
 * the gateway first, then fall back to calling Google directly.
 */
async function fetchPlaceDetails(placeId: string, fieldMask: string) {
  const path = `/places/v1/places/${encodeURIComponent(placeId)}`;

  const gatewayRes = await fetch(`${GATEWAY_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY!,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": fieldMask,
    },
  });
  if (gatewayRes.ok) return { ok: true as const, place: await gatewayRes.json() };

  const gatewayBody = await gatewayRes.text();
  console.error(`[google-reviews] gateway ${gatewayRes.status}: ${gatewayBody}`);

  const directRes = await fetch(`${DIRECT_URL}${path}`, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": fieldMask,
    },
  });
  if (directRes.ok) return { ok: true as const, place: await directRes.json() };

  const directBody = await directRes.text();
  console.error(`[google-reviews] direct ${directRes.status}: ${directBody}`);
  return {
    ok: false as const,
    response: json(
      {
        error: "Google could not return that listing.",
        status: directRes.status,
        details: directBody,
        gateway_details: gatewayBody,
      },
      directRes.status,
    ),
  };
}

/** Pull a place ID out of a raw value or a Google Maps URL, if present. */
const placeIdFrom = (value: string): string | null => {
  const v = value.trim();
  const direct = v.match(/^(ChI[A-Za-z0-9_-]{10,})$/);
  if (direct) return direct[1];
  const m =
    v.match(/place_id[:=]([A-Za-z0-9_-]+)/) ??
    v.match(/!1s(ChI[A-Za-z0-9_-]+)/) ??
    v.match(/\b(ChI[A-Za-z0-9_-]{20,})\b/);
  return m ? m[1] : null;
};

/** Expand a maps.app.goo.gl / goo.gl/maps short link into its full URL. */
async function expandShortLink(value: string): Promise<string | null> {
  const m = value.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[A-Za-z0-9_-]+/);
  if (!m) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(m[0], { method: "GET", redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    const body = await res.text().catch(() => "");
    // The place ID sometimes only appears in the page body, not the final URL.
    const inBody = placeIdFrom(body);
    return inBody ? `place_id=${inBody}` : res.url || null;
  } catch (e) {
    console.error("[google-reviews] short link expansion failed:", e);
    return null;
  }
}

async function readSetting(admin: any, key: string): Promise<string | null> {
  const { data } = await admin.from("site_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return data?.setting_value ?? null;
}

async function writeSetting(admin: any, key: string, value: string) {
  const { data } = await admin.from("site_settings").select("id").eq("setting_key", key).maybeSingle();
  if (data?.id) {
    await admin.from("site_settings").update({ setting_value: value }).eq("id", data.id);
  } else {
    await admin.from("site_settings").insert({ setting_key: key, setting_value: value });
  }
}

async function syncReviews(admin: any, placeId: string) {
  const mask = "id,displayName,rating,userRatingCount,googleMapsUri,reviews";
  const out = await fetchPlaceDetails(placeId, mask);
  if (!out.ok) return { errorResponse: out.response };

  const place = out.place;
  const reviews: any[] = place.reviews ?? [];

  const rows = reviews.map((r) => ({
    review_key: r.name ?? `${placeId}:${r.authorAttribution?.displayName}:${r.publishTime}`,
    author_name: r.authorAttribution?.displayName ?? "Google user",
    author_photo_url: r.authorAttribution?.photoUri ?? null,
    author_uri: r.authorAttribution?.uri ?? null,
    rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
    text: r.originalText?.text ?? r.text?.text ?? null,
    relative_time: r.relativePublishTimeDescription ?? null,
    publish_time: r.publishTime ?? null,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await admin.from("google_reviews").upsert(rows, { onConflict: "review_key" });
    if (error) throw error;
    const keep = rows.map((r) => r.review_key);
    await admin.from("google_reviews").delete().not("review_key", "in", `(${keep.map((k) => `"${k}"`).join(",")})`);
  }

  await writeSetting(admin, "google_place_id", place.id ?? placeId);
  await writeSetting(admin, "google_place_name", place.displayName?.text ?? "");
  await writeSetting(admin, "google_rating", String(place.rating ?? ""));
  await writeSetting(admin, "google_rating_count", String(place.userRatingCount ?? ""));
  await writeSetting(admin, "google_maps_uri", place.googleMapsUri ?? "");
  await writeSetting(admin, "google_reviews_synced_at", new Date().toISOString());

  return {
    result: {
      ok: true,
      place_id: place.id ?? placeId,
      place_name: place.displayName?.text ?? "",
      rating: place.rating ?? null,
      rating_count: place.userRatingCount ?? null,
      maps_uri: place.googleMapsUri ?? "",
      synced: rows.length,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GOOGLE_MAPS_API_KEY) {
      return json({ error: "Google Maps API key is not configured." }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY"))!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Scheduled runs: no session, sync only, never more than once every 12 hours.
    if (body.cron === true) {
      if (action !== "sync") return json({ error: "Scheduled runs can only sync." }, 400);
      const enabled = await readSetting(admin, "google_reviews_enabled");
      if (enabled !== "true") return json({ skipped: "disabled" });
      const last = await readSetting(admin, "google_reviews_synced_at");
      if (last && Date.now() - new Date(last).getTime() < 12 * 60 * 60 * 1000) {
        return json({ skipped: "recently synced" });
      }
      const placeId = await readSetting(admin, "google_place_id");
      if (!placeId) return json({ skipped: "no listing" });
      const out = await syncReviews(admin, placeId);
      if (out.errorResponse) return out.errorResponse;
      return json(out.result);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sign in required." }, 401);
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Sign in required." }, 401);
    const { data: roleRow } = await admin
      .from("user_roles").select("role, permissions").eq("user_id", user.id).maybeSingle();
    const allowed = roleRow?.role === "admin" || roleRow?.permissions?.can_manage_settings === true;
    if (!allowed) return json({ error: "You need settings permission to manage Google reviews." }, 403);

    if (action === "save") {
      const input = String(body.input ?? "").trim().slice(0, 500);
      if (!input) return json({ error: "Paste your Google Maps link or Place ID." }, 400);

      let placeId = placeIdFrom(input);
      if (!placeId) {
        const expanded = await expandShortLink(input);
        if (expanded) placeId = placeIdFrom(expanded);
      }
      if (!placeId) {
        return json({
          error:
            "No Place ID found in what you pasted. Open your listing on Google Maps, copy the Place ID (it starts with \"ChI\"), and paste that here.",
        }, 400);
      }

      const out = await syncReviews(admin, placeId);
      if (out.errorResponse) return out.errorResponse;
      return json(out.result);
    }

    if (action === "sync") {
      const placeId = String(body.place_id ?? "").trim() || (await readSetting(admin, "google_place_id"));
      if (!placeId) return json({ error: "No Google listing saved yet." }, 400);
      const out = await syncReviews(admin, placeId);
      if (out.errorResponse) return out.errorResponse;
      return json(out.result);
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[google-reviews] failed:", message);
    return json({ error: message }, 500);
  }
});
