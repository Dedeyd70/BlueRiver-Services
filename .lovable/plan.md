# BlueRiver Performance & Storage Audit — Implementation

## Context (from live audit)
Database is a few MB total (largest table `bookings` = 168 kB / 36 rows); `site-images` storage is 12 MB / 63 files. **Space is not the bottleneck** — the cost driver is redundant read *volume* and oversized payloads (e.g. `notifications` 3,835 reads, `site_settings` 2,803, `services` 2,133). All 5 optimizations target that.

Destructive housekeeping (orphan sweep, log retention) will be **manual admin buttons that report first and only delete after explicit confirmation**.

## 1. Realtime notifications (replace 30s polling)
In `NotificationBell.tsx`:
- Remove `refetchInterval: 30000`.
- Add a `useEffect` realtime subscription on `public.notifications` (event `*`) that calls `qc.invalidateQueries(["admin-notifications"])`, torn down on unmount (same pattern as `Dashboard.tsx`).
- Narrow the select to `id, message, is_read, reference_type, reference_id, created_at`.
- Migration: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` (and set `REPLICA IDENTITY FULL`).

## 2. Aggressive caching + lean selects for static public content
For `useServices`, `useSocialLinks`, `useServiceAreas`, `useSiteSettings`, and the `testimonials` / `gallery` / `homepage_images` / `faqs` / `reviews` queries in pages:
- Set `staleTime: 30–60 min` and a long `gcTime`.
- Replace `select("*")` with explicit columns each component actually renders.

## 3. Payload reduction on heavy admin lists (lazy JSONB)
For `BookingsAdmin`, `QuotesAdmin`, `InvoicesAdmin`, and `Submissions`:
- List queries select only summary columns (name, email, phone, status, dates, totals, service_type) — **exclude** large JSONB (`line_items`, `custom_fields`, `breakdown`, `selected_addons`).
- Fetch the full row (incl. JSONB) lazily via a per-record query keyed by id, enabled only when a card is expanded/opened. Booking and invoicing detail/PDF flows keep all data they need — verified before shipping.

## 4. Manual cleanup tools (report-first, admin-only)
New admin page **Maintenance** (under settings) with two tools, each a two-step Report → Confirm Delete flow:
- **Orphaned media sweep:** lists `site-images` objects not referenced by `gallery`, `homepage_images`, or `branding_settings`. Shows file list + sizes; delete only on confirm.
- **Log/notification retention:** `cleanup_old_records(p_days, p_dry_run)` SECURITY DEFINER RPC (admin-gated) returning counts per table for `notifications`, `booking_activity_logs`, `contact_activity_logs` older than the chosen window; deletes only when `p_dry_run = false`.

## 5. Forward-looking indexes
Single migration (honest note: negligible at current row counts, this is for scale):
- `notifications(created_at)`
- `bookings(created_at)`
- `bookings(booking_date, status)` (slot-overlap checks)

## Technical notes
- One migration covers: realtime publication for notifications, the `cleanup_old_records` RPC, and the three indexes.
- Caching/lean-select/lazy-load changes are frontend-only — no business logic altered.
- After implementation I'll load the preview and confirm booking + invoice flows render full data before handing back to you.
