

# ID-Based Service Relationships (Replace Name Matching)

## Current state — name matching everywhere
- `quote_requests.service_type` is a free-text string (no `service_type_id` column)
- `pricingEngine.computeQuote` resolves the service via `s.name.toLowerCase() === request.service_type.toLowerCase()` (line 82-84)
- `DynamicQuoteSummary` resolves via `ilike("name", ...)` (line 21)
- `RequestQuote.tsx` resolves via name match against `service_types` to fetch fields
- `ServicesAdmin.tsx` deletes `service_types` row by `name` match
- Same for `bookings.service_type`, `quote_drafts.service_type`, `invoices.services` (all snapshots)

## Target state — `service_type_id` is the primary link, name is snapshot only

---

## Changes (1 migration + 6 files)

### 1. Migration — add ID columns + backfill + lock with snapshot
- `ALTER TABLE quote_requests ADD COLUMN service_type_id uuid` (nullable for legacy)
- `ALTER TABLE quote_drafts ADD COLUMN service_type_id uuid`
- `ALTER TABLE bookings ADD COLUMN service_type_id uuid`
- `ALTER TABLE invoices ADD COLUMN service_type_id uuid`
- **Backfill**: `UPDATE quote_requests SET service_type_id = st.id FROM service_types st WHERE lower(quote_requests.service_type) = lower(st.name)` (and same for the other 3 tables)
- **No FK constraint** on these — keep nullable and unconstrained so deleting a service does NOT cascade-wipe history (only sets the link to dangling). Existing string `service_type` column stays as the snapshot.
- Indexes: `CREATE INDEX ON quote_requests (service_type_id)` (and the others) for fast filtering

### 2. `src/pages/RequestQuote.tsx`
- Service dropdown `<option value={serviceType.id}>` instead of value=title — store `service_type_id` in form state alongside the display name
- `useQuery(["public-service-fields", service_type_id])` — lookup directly by ID, no name matching
- Insert into `quote_requests` includes `service_type_id` plus the existing `service_type` (name snapshot)

### 3. `src/lib/pricingEngine.ts`
- Add `service_type_id?: string` to `QuoteRequestLike`
- Replace name match (line 82-84) with: `serviceTypes.find(s => s.id === request.service_type_id)`
- Fallback (only when `service_type_id` missing — i.e. legacy rows): keep current name match, behind a comment marking it as the legacy path. Keeps backward compatibility.
- `ruleFor()` and `serviceFields` filter already use `matchedService.id` → no change

### 4. `src/components/admin/DynamicQuoteSummary.tsx`
- Change props: accept `serviceTypeId: string | null` (primary) and `serviceTypeName` (fallback for legacy rows without ID)
- If `serviceTypeId` present → fetch fields directly by ID (skip name-lookup query)
- If only name present → resolve to ID once via `eq("name", ...)` (kept for legacy backward compat), then fetch fields by ID
- All field-loading goes through `service_type_id`

### 5. `src/pages/admin/QuotesAdmin.tsx`
- Pass `prepareTarget.service_type_id` (preferred) and `prepareTarget.service_type` (fallback) to `<DynamicQuoteSummary />`
- When computing the quote, pass `service_type_id` through to `computeQuote`
- When inserting `quote_drafts` and (later) `bookings`, persist `service_type_id` from the quote
- Service type select inside Prepare Quote dialog uses `service_types.id` as value, name as label

### 6. `src/pages/admin/ServicesAdmin.tsx`
- On create: already inserts a matching `service_types` row — keep, but also store the returned `service_type_id` on the `services` row? Not needed — `services` is marketing-only. No change here.
- On delete: continue removing matching `service_types` row by name (no `service_type_id` link exists on `services` table). The DB cascade from the previous migration cleans `service_fields` + `service_pricing_rules`. **Historical** `quote_requests`/`bookings`/`invoices` keep their name snapshot and dangling `service_type_id` — by design.

### 7. `src/components/admin/PricingSettings.tsx`
- Already uses `service_type_id` in the dropdown (after the previous refactor) → confirm and leave as-is.

---

## Backward compatibility
- All 4 tables get a nullable `service_type_id` — old rows with NULL still render via the name fallback in `DynamicQuoteSummary` and `pricingEngine`
- String `service_type` column kept on every table as a permanent snapshot (so renaming/deleting a service never breaks history)
- No FK constraints on history tables → deleting a service is safe; old quotes still display the original service name

## What stays untouched
- Pricing math (no formula changes)
- UI layout (only dropdown `value` attributes change from name → id)
- Booking, invoice, notification flows
- PDF generation
- `service_fields` / `service_pricing_rules` schema (already ID-based)

## Files Touched

| File | Change |
|---|---|
| New migration | Add `service_type_id` to quote_requests, quote_drafts, bookings, invoices + backfill + indexes |
| `src/lib/pricingEngine.ts` | Resolve service via ID first, name fallback for legacy |
| `src/pages/RequestQuote.tsx` | Service dropdown stores ID; field query keyed by ID; insert includes `service_type_id` |
| `src/components/admin/DynamicQuoteSummary.tsx` | Accept `serviceTypeId` prop; fetch fields by ID |
| `src/pages/admin/QuotesAdmin.tsx` | Pass `service_type_id` everywhere; persist to `quote_drafts` |
| `src/pages/admin/ServicesAdmin.tsx` | (no change — already correct) |
| `src/integrations/supabase/types.ts` | Auto-regenerated |

