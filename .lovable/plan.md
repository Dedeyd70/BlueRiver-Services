

# Cleanup & Unify Form / Summary / Pricing

## What's broken (confirmed via DB inspection)
- **84 PascalCase legacy rules** (`Bedroom`, `FullBath`, `Kitchen`, `LivingRoom`, `OfficeRoom`, `HalfBath`, `Bathroom`) all priced $0 — pollute admin Pricing UI, never used by engine.
- **1 orphan rule** `washroom` on empty `hospital cleaning` service.
- **Property Summary** in `QuotesAdmin.tsx` (lines 733-767) reads hardcoded typed columns regardless of selected service.
- **No FK cascade** — deleting a service leaves `service_fields` and `service_pricing_rules` orphaned.
- **`ServicesAdmin.tsx` delete** removes from `services` only, not the matching `service_types` row.

## Changes (4 files + 1 migration)

### 1. Migration — DB cleanup + cascade integrity
- `DELETE` all `service_pricing_rules` where `category` is in the legacy PascalCase set (`Bedroom`, `Bathroom`, `FullBath`, `HalfBath`, `Kitchen`, `LivingRoom`, `OfficeRoom`, `washroom`).
- `DELETE` any `service_pricing_rules` / `service_fields` whose `service_type_id` no longer exists in `service_types` (orphans).
- Add `FOREIGN KEY ... ON DELETE CASCADE` from `service_fields.service_type_id` → `service_types.id` and `service_pricing_rules.service_type_id` → `service_types.id`. Future service deletions auto-clean linked rows.
- **Historical data preserved**: no touches to `bookings`, `quote_drafts`, `invoices`, `quote_requests`. Their string `service_type` column already snapshots the name; line_items/services jsonb already snapshot pricing.

### 2. `src/lib/pricingEngine.ts` — already snake_case-only via `field_key`
- Confirm and tighten: legacy fallback path that addresses categories like `Bedroom`/`FullBath` (only triggered when `serviceFields.length === 0`) is removed. Engine resolves **only** via `service_pricing_rules.category === service_fields.field_key` filtered by `service_type_id`.

### 3. `src/pages/admin/QuotesAdmin.tsx` — dynamic Property Summary
- Replace hardcoded grid (lines 733-767) with a renderer that:
  - Looks up `service_type_id` by matching `prepareTarget.service_type` to `service_types.name` (one query, cached via React Query).
  - Fetches `service_fields` for that id, ordered by `display_order`.
  - For each field: read value from typed column if it exists (`bedrooms`, `full_bathrooms`, etc.), otherwise from `prepareTarget.custom_fields[field_key]`.
  - Renders `Label: value` only for fields belonging to that service.
- Common header rows (Service, Property, Sq ft, Frequency, Pets) stay — they're cross-service intake metadata, not pricing fields.
- Addons chips, entry codes, condition badge, description — unchanged.

### 4. `src/pages/admin/ServicesAdmin.tsx` — cascade delete
- In `remove` mutation, after deleting from `services`, also `DELETE` the matching `service_types` row by name. The new FK cascade then automatically removes linked `service_fields` and `service_pricing_rules`.
- Invalidate `["admin-service-types"]` and `["admin-services"]` query keys so Pricing UI and dropdowns refresh instantly.

### 5. `src/components/admin/PricingSettings.tsx` — minor
- After cleanup migration, the "$0" PascalCase rows disappear naturally. No code change needed beyond ensuring the auto-heal logic only inserts snake_case keys (already does — uses `field_key`).

## What stays untouched
- Booking, invoice, quote workflows — no logic change.
- UI layout — only the inner grid of Property Summary changes its data source.
- Pricing engine formula — no change.
- PDF generation — unchanged.
- Customer form — unchanged.
- `quote_requests` typed columns — kept (used as primary source where present, custom_fields as fallback).

## Files Touched

| File | Change |
|---|---|
| New migration | Delete legacy PascalCase + orphan rules; add ON DELETE CASCADE FKs |
| `src/lib/pricingEngine.ts` | Remove legacy fallback branch |
| `src/pages/admin/QuotesAdmin.tsx` | Dynamic service-field-driven Property Summary |
| `src/pages/admin/ServicesAdmin.tsx` | Delete linked `service_types` row on service delete |

