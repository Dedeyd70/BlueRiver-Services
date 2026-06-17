# Fix admin login realtime crash

## Problem
Logging into admin throws:
`cannot add 'postgres_changes' callbacks for realtime:admin-notifications-bell after subscribe()`

This crashes the admin shell because `NotificationBell` mounts inside `AdminLayout`.

## Root cause
`supabase.channel(name)` reuses an existing channel instance when one with the **same topic name** is still registered. `removeChannel()` (in the effect cleanup) is asynchronous, so on a fast re-mount — which happens during the auth/role resolution cycle in `AdminLayout` and under React StrictMode — the new effect calls `supabase.channel("admin-notifications-bell")` and gets back the **already-subscribed** channel from the previous mount. Calling `.on("postgres_changes", ...)` on a channel that has already had `.subscribe()` called throws this exact error.

The same fragile fixed-name pattern exists in three places:
- `src/components/admin/NotificationBell.tsx` → `"admin-notifications-bell"` (the one currently crashing)
- `src/pages/admin/Dashboard.tsx` → `"dashboard-stats"`
- `src/hooks/useAuth.tsx` → `user-role-${uid}` (still a fixed topic per user, can collide on remount)

## Fix
Give each channel subscription a **unique name per mount** so `.channel()` always returns a fresh, un-subscribed instance. Generate the suffix inside the effect (e.g. `crypto.randomUUID()`) and keep the existing cleanup that calls `supabase.removeChannel(channel)`.

```text
const channel = supabase.channel(`admin-notifications-bell-${crypto.randomUUID()}`)
  .on("postgres_changes", { event: "*", schema: "public", table: "notifications" },
      () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }))
  .subscribe();
return () => { supabase.removeChannel(channel); };
```

Apply the same unique-suffix change to:
1. `NotificationBell.tsx` — `admin-notifications-bell-<uuid>`
2. `Dashboard.tsx` — `dashboard-stats-<uuid>`
3. `useAuth.tsx` — `user-role-${uid}-<uuid>`

No database, RLS, or business-logic changes are needed — the realtime publication and the subscription logic stay exactly the same; only the channel topic strings change to be collision-free.

## Verification
- Load the preview, log in to the admin dashboard, and confirm the console no longer throws the `postgres_changes after subscribe()` error and the dashboard renders.
- Confirm the notification bell still updates in realtime and booking/invoice flows are unaffected.
