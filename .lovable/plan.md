

# Dynamic Service Fields — DB-Driven Form + Pricing

## What already exists (preserve, don't rebuild)
- `service_types` table with base_price ✅
- `service_pricing_rules` table with category + unit_price ✅
- `condition_settings` table with integer surcharges ✅
- `quote_drafts.line_items` JSONB ✅
- Itemized Prepare-Quote table in `QuotesAdmin.tsx` ✅
- `pricingEngine.ts` computing line items ✅
- Quote PDF rendering line items ✅
- Customer form with dynamic groups in `RequestQuote.tsx` ✅
- Admin "Pricing Settings" tab ✅

## What's missing (the gap)
- `ROOM_CATEGORIES` array is **hardcoded** in `PricingSettings.tsx` — categories should be admin-defined per service
- Customer form groups (`residential`/`deep`/`commercial`/`move`/`recurring`) are **hardcoded by name-matching** — should be driven by DB
- No `service_fields` table linking field definitions to a service

## The change — additive only

### 1. New table: `service_fields`
```
id uuid pk
service_type_id uuid → service_types(id) on delete cascade
field_key text         -- e.g. "bedrooms", "office_rooms"
label text             -- "Bedrooms"
input_type text        -- 'number' | 'select' | 'toggle'
options jsonb default '[]'  -- for select inputs
required boolean default false
display_order integer default 0
unique(service_type_id, field_key)
```
RLS: admin manage / public read (matches existing pattern).

Seed from current hardcoded categories so nothing breaks for existing services (Bedrooms, Bathrooms, FullBath, HalfBath, Kitchen, LivingRoom, OfficeRoom — number inputs).

### 2. Admin "Configure Service" — extend `PricingSettings.tsx`
- Replace hardcoded `ROOM_CATEGORIES` with `service_fields` rows fetched per service
- Each service card gains: list of fields (label + input_type + price input), "+ Add Field" dialog (key, label, input_type, required), delete button per row
- `service_pricing_rules.category` continues to map to `field_key` (already aligned — no schema change to that table)
- New service flow: `ServicesAdmin.tsx` Create → after insert into `services`, also insert matching `service_types` row, then toast "Configure pricing in Settings → Pricing"

### 3. Dynamic customer form — refactor `RequestQuote.tsx`
- Fetch `service_fields` for selected service via React Query
- Replace hardcoded `serviceGroup` switch with single generic renderer that maps each field to the right control (`number` → Input, `select` → select with options, `toggle` → Checkbox)
- Keep all existing common fields (name/email/phone/address/property/sq ft/condition/addons/description/upload) untouched
- Submit payload: existing typed columns kept for known keys (bedrooms, bathrooms, etc.); unknown custom keys stored in a new `custom_fields jsonb` column on `quote_requests` (additive, nullable)

### 4. Pricing engine — `pricingEngine.ts`
- Already category-driven via `service_pricing_rules.category === field_key` — only change: read field values dynamically from `quote_requests.custom_fields` (fallback) **plus** existing typed columns. No formula change.

### 5. Prepare Quote dialog — `QuotesAdmin.tsx`
- No UI change. Itemized table already renders whatever line items the engine produces, so adding new field types automatically flows through.

### 6. Quote PDF
- No change. Already renders `line_items` array generically.

## Files Touched

| File | Change |
|---|---|
| **New migration** | Create `service_fields` table + RLS; add `custom_fields jsonb` to `quote_requests`; seed default fields for existing service_types |
| `src/components/admin/PricingSettings.tsx` | Replace `ROOM_CATEGORIES` constant with DB-driven fields; add field CRUD UI per service |
| `src/pages/admin/ServicesAdmin.tsx` | On create, also upsert `service_types` row; success toast links to Pricing tab |
| `src/pages/RequestQuote.tsx` | Replace hardcoded group switch with `<DynamicFields service_type_id=... />` renderer; keep all common fields |
| `src/lib/pricingEngine.ts` | Read custom_fields jsonb in addition to typed columns |
| `src/integrations/supabase/types.ts` | Auto-regenerated |

No removed tables, no removed UI, no breaking changes. Existing quotes/bookings/PDFs continue working.

