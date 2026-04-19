

# Booking Form → Service-Driven Dynamic (Patch)

## Schema gap

`bookings` lacks `custom_fields` (quote_requests has it). Need migration to add it so unknown dynamic fields persist — same pattern as quotes.

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Existing typed columns on bookings (kept, used when field_key matches): `bedrooms`, `bathrooms`, `frequency`, `has_pets`, `entry_codes`, `square_footage`, `property_type`. Anything else from `service_fields` → `custom_fields`.

## Code changes — `src/pages/BookService.tsx` only

Mirror the quote form's dynamic pattern. **No layout redesign** — just swap the hardcoded property-detail block for the same Service Type → service_fields engine.

1. **Add state**: `service_type_id`, `dynValues: Record<string, any>`.
2. **Fetch `service_types`** (`useQuery` `public-service-types`) — same query as quote form.
3. **Resolve `matchedServiceType`** by id (fallback by name for prefilled `?service=` deep links from the homepage cards — preserves quote→booking & service card flows).
4. **Fetch `service_fields`** for the matched id (same query key as quote form → cache-shared).
5. **Replace the Property Details block** (the bedrooms/bathrooms/sq-ft/frequency/property-type grid in the form's left column, lines ~285-335 of `BookService.tsx`) with:
   - The Service selector becomes the **first** field (move up before name/email block keeping current visual order: keep name/email/phone/address as-is; the Service selector is already in the form, just make it `service_type_id`-driven like quote form).
   - After selection: render Property Type + Sq Ft (kept as common fields), then map `serviceFields` through the existing `DynamicField` component.
6. **Extract `DynamicField`** — copy the component from `RequestQuote.tsx` into a new shared file `src/components/DynamicField.tsx` and import from both pages. Avoids duplication; same render logic for `number | select | toggle`.
7. **Submit handler**: split `dynValues` into typed columns vs `custom_fields`. Typed-column allowlist for bookings:
   ```ts
   const BOOKING_TYPED = new Set(["bedrooms","bathrooms","frequency","has_pets","entry_codes","square_footage","property_type"]);
   ```
   Numeric coerce for `bedrooms`/`bathrooms`; boolean coerce for `has_pets`; string for the rest. Everything else → `custom_fields` JSON.
8. **Validate required dynamic fields** the same way the quote form does (loop `serviceFields`, check `dynValues[field_key]`).
9. **Persist `service_type_id`** on the bookings insert (column already exists).

## Untouched (per critical rules)

- Date/time picker, calendar, slot logic, double-booking RPC, rate-limit RPC, notify, addon block, price summary, consent, success state.
- `quote_requests` flow, `createInvoiceFromBooking`, `pricingEngine`.
- All RLS, no admin pages.
- The hardcoded fallback `service` text column on bookings stays populated (for legacy display in admin lists).

## Files Touched

| File | Change |
|---|---|
| New migration | `ALTER TABLE bookings ADD COLUMN custom_fields jsonb` |
| New `src/components/DynamicField.tsx` | Shared dynamic field renderer extracted from RequestQuote |
| `src/pages/RequestQuote.tsx` | Import shared `DynamicField`, delete inline copy |
| `src/pages/BookService.tsx` | Service-type-driven dropdown + `service_fields` query + replace hardcoded property-detail grid with dynamic block + split typed/custom on submit |

## Result

Booking form behaves like the quote form: pick **Commercial Cleaning** → only the configured fields (Half Bathrooms, Kitchens, Conference Rooms, Office Rooms…) appear. Pick **Residential** → bedrooms/bathrooms/etc. Same data shape feeds pricing engine & invoice generation.

