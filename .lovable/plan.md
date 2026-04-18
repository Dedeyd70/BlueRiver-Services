

# Stabilize service_type_id — Final Pre-FK Cleanup

## Scope
Close the last 3 gaps so every new + historical record carries `service_type_id`. No FK enforcement yet.

## Changes (1 code file + 1 data migration)

### 1. `src/lib/createInvoiceFromBooking.ts` — write `service_type_id`
- Add `service_type_id: booking.service_type_id ?? null` to the `invoices.insert({...})` payload (line 55-69).
- No other logic changes. Booking flow already guarantees `booking.service_type_id` is populated for all new bookings (verified: 29/29 rows have it).

### 2. Data migration — backfill existing rows

**Backfill invoices from bookings (14 rows):**
```sql
UPDATE public.invoices i
SET service_type_id = b.service_type_id
FROM public.bookings b
WHERE i.service_type_id IS NULL
  AND i.booking_id IS NOT NULL
  AND b.id = i.booking_id
  AND b.service_type_id IS NOT NULL;
```

**Backfill the 1 stray quote_requests row** (case-insensitive name match; leaves NULL if no match):
```sql
UPDATE public.quote_requests qr
SET service_type_id = st.id
FROM public.service_types st
WHERE qr.service_type_id IS NULL
  AND qr.service_type IS NOT NULL
  AND lower(qr.service_type) = lower(st.name);
```

**Index for invoices** (the previous migration already added indexes for the other 3 tables — confirm/add):
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_service_type_id ON public.invoices(service_type_id);
```

## Post-migration expected state

| Table | service_type_id NULL allowed? | Coverage after run |
|---|---|---|
| `quote_requests` | yes (legacy) | 20-21/21 |
| `quote_drafts` | no in practice | 4/4 |
| `bookings` | no in practice | 29/29 |
| `invoices` | no in practice | 14/14 |

## What stays untouched
- No FK constraints added (per instructions).
- Pricing engine, summary, booking, quote workflows — no logic change.
- Name-fallback branches in `pricingEngine.ts` / `DynamicQuoteSummary.tsx` / `RequestQuote.tsx` stay as backstops for any future legacy NULL row.
- UI — no changes.
- `service_type` (name snapshot) columns kept on all 4 tables.

## Files Touched

| File | Change |
|---|---|
| `src/lib/createInvoiceFromBooking.ts` | Include `service_type_id` from booking in insert payload |
| New migration | Backfill `invoices.service_type_id` from bookings + 1 stray quote_request + invoices index |

## Verification after run
- `SELECT count(*) FROM invoices WHERE service_type_id IS NULL` → expect 0
- `SELECT count(*) FROM quote_requests WHERE service_type_id IS NULL` → expect 0 or 1 (only if the stray row's name doesn't match any service_type)
- New booking → completed → invoice generated → `service_type_id` populated automatically

