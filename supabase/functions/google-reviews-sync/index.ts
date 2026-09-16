import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const gatewayHeaders = (extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY!,
  "Content-Type": "application/json",
  ...extra,
});

/** Pull a place ID out of a pasted Google Maps URL, if present. */
const placeIdFromUrl = (value: string): string | null => {
  const direct = value.trim().match(/^(ChI[A-Za-z0-9_-]{10,})$/);
  if (direct) return direct[1];
  const m = value.match(/place_id[:=]([A-Za-z0-9_-]+)/) ?? value.match(/!1s(ChI[A-Za-z0-9_-]+)/);
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
    // Drain the body so the connection is released.
    await res.text().catch(() => "");
    return res.url || null;
  } catch (e) {
    console.error("[google-reviews] short link expansion failed:", e);
    return null;
  }
}

/** Read business name and coordinates out of a long-form Google Maps URL. */
function parseMapsUrl(url: string): { name: string | null; lat: number | null; lng: number | null } {
  let name: string | null = null;
  const nameMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (nameMatch) {
    try {
      name = decodeURIComponent(nameMatch[1].replace(/\+/g, " ")).trim();
    } catch {
      name = nameMatch[1].replace(/\+/g, " ").trim();
    }
  }
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const d = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const coords = d ?? at;
  return {
    name,
    lat: coords ? Number(coords[1]) : null,
    lng: coords ? Number(coords[2]) : null,
  };
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

async function handleGatewayError(res: Response) {
  const body = await res.text();
  console.error(`[google-reviews] gateway ${res.status}: ${body}`);
  return json({ error: "Google request failed", status: res.status, details: body }, res.status);
}

async function syncReviews(admin: any, placeId: string) {
  const mask = "id,displayName,rating,userRatingCount,googleMapsUri,reviews";
  const res = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(placeId)}`, {
    headers: gatewayHeaders({ "X-Goog-FieldMask": mask }),
  });
  if (!res.ok) return { errorResponse: await handleGatewayError(res) };

  const place = await res.json();
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

  await writeSetting(admin, "google_place_id", placeId);
  await writeSetting(admin, "google_place_name", place.displayName?.text ?? "");
  await writeSetting(admin, "google_rating", String(place.rating ?? ""));
  await writeSetting(admin, "google_rating_count", String(place.userRatingCount ?? ""));
  await writeSetting(admin, "google_maps_uri", place.googleMapsUri ?? "");
  await writeSetting(admin, "google_reviews_synced_at", new Date().toISOString());

  return {
    result: {
      ok: true,
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
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return json({ error: "Google Maps connection is not configured." }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY"))!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // The scheduled job runs in cron mode: no session, sync only, and it can
    // never hit Google more than once every 12 hours no matter who calls it.
    const isCron = body.cron === true;

    if (isCron) {
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

    if (action === "lookup") {
      const query = String(body.query ?? "").trim().slice(0, 200);
      if (!query) return json({ error: "Enter a business name or Google Maps link." }, 400);

      const direct = placeIdFromUrl(query);
      if (direct) {
        const res = await fetch(`${GATEWAY_URL}/places/v1/places/${encodeURIComponent(direct)}`, {
          headers: gatewayHeaders({
            "X-Goog-FieldMask": "id,displayName,formattedAddress,rating,userRatingCount",
          }),
        });
        if (!res.ok) return await handleGatewayError(res);
        const p = await res.json();
        return json({ candidates: [{
          id: p.id, name: p.displayName?.text ?? "", address: p.formattedAddress ?? "",
          rating: p.rating ?? null, rating_count: p.userRatingCount ?? null,
        }] });
      }

      const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
        method: "POST",
        headers: gatewayHeaders({
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
        }),
        body: JSON.stringify({ textQuery: query, pageSize: 5 }),
      });
      if (!res.ok) return await handleGatewayError(res);
      const data = await res.json();
      const candidates = (data.places ?? []).slice(0, 5).map((p: any) => ({
        id: p.id,
        name: p.displayName?.text ?? "",
        address: p.formattedAddress ?? "",
        rating: p.rating ?? null,
        rating_count: p.userRatingCount ?? null,
      }));
      return json({ candidates });
    }

    if (action === "sync") {
      const placeId = String(body.place_id ?? "").trim() || (await readSetting(admin, "google_place_id"));
      if (!placeId) return json({ error: "No Google business selected yet." }, 400);
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
