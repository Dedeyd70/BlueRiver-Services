
# Safe-Mode Quote → Booking → Invoice → Receipt — Extension Plan

This plan **extends** existing behaviour. It does not rebuild the flow, does not touch existing triggers/automation, and never recalculates pricing. All financial snapshots stay immutable.

---

## What already exists (and we will reuse, not replace)

The database already enforces most of the spec at the constraint and RPC level:

| Guarantee | How it's enforced today |
|---|---|
| 1 quote → 1 booking | `UNIQUE (quote_id)` on `bookings` + RPC `convert_quote_to_booking` returns existing row if found |
| 1 booking → 1 invoice | `UNIQUE (booking_id)` on `invoices` + RPC `create_invoice_from_booking` returns existing row if found |
| 1 invoice → 1 receipt | `UNIQUE (invoice_id)` on `receipts` + RPC `create_receipt` returns existing row if found |
| No pricing recalc | All three RPCs copy `line_items` and totals verbatim from the parent record |
| Invoice numbering | Function `generate_invoice_number()` called inside `create_invoice_from_booking` RPC (format `BR-YYYY-####`) |
| Receipt auto-generation on payment | `mark_invoice_paid` RPC sets `paid_at` + status, then calls `create_receipt` |

**Important finding:** there are currently **no triggers** in the public schema. `generate_invoice_number` is invoked directly by the RPC, not by a trigger. So "don't interfere with triggers" reduces to "don't bypass the RPCs."

---

## Critical bug found during audit (must fix or receipts break)

`create_receipt` calls `generate_receipt_number()` — but that function **does not exist** in the database. Any call to `mark_invoice_paid` will throw at the receipt step, leaving the invoice marked paid but no receipt created. This silently breaks the entire payment flow.

**Fix:** add the missing function (mirroring the invoice-number pattern):

```sql
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text LANGUAGE sql VOLATILE SET search_path TO 'public' AS $$
  SELECT 'BR-RC-' || to_char(now(),'YYYY') || '-' ||
         lpad(nextval('public.receipt_number_seq')::text, 4, '0');
$$;
```

No change to `create_receipt` itself — it already references the function name.

---

## Frontend work — make the app go through the RPCs

Audit of the codebase shows the app currently bypasses the safe RPCs in two places:

1. **`src/lib/createInvoiceFromBooking.ts`** — does its own `INSERT INTO invoices` with recalculated totals from `quote_drafts`. This violates the "never recalculate" rule.
2. **QuotesAdmin convert-to-booking flow** — uses direct `.insert()` on `bookings`.

### Changes (4 files, all minimal):

| File | Change |
|---|---|
| `src/lib/createInvoiceFromBooking.ts` | Replace the entire body with a single call to `supabase.rpc('create_invoice_from_booking', { p_booking_id: booking.id })`. Preserves the existing function signature so callers don't change. |
| `src/pages/admin/QuotesAdmin.tsx` (`convertToBooking`) | Replace direct insert with `supabase.rpc('convert_quote_to_booking', { p_quote_id: quoteId })`. The RPC already returns the existing booking if one exists — no client-side existence check needed. |
| `src/pages/admin/InvoicesAdmin.tsx` (`applyPayment` / mark-paid) | When payment is fully applied, call `supabase.rpc('mark_invoice_paid', { p_invoice_id: invoiceId })` instead of the current direct UPDATE. This guarantees receipt auto-creation. |
| `src/pages/admin/BookingsAdmin.tsx` | Conditionally hide the "Generate Invoice" button when `booking.source = 'quote'` or `booking.quote_id IS NOT NULL`. Show the spec'd button set instead: View Invoice / Send Invoice / Mark as Paid / Generate Receipt. Manual bookings keep all buttons. |

**No prop, route, layout, or naming changes.** Only handler bodies and one piece of conditional rendering.

---

## RLS hardening (security audit follow-up — same scope)

The audit flagged three public read leaks that are unrelated to safe-mode but should be closed in the same migration since we're already touching policies:

| Table | Current problem | Fix |
|---|---|---|
| `quote_requests` | `Admin can view quotes` policy uses `auth.role() = 'authenticated'` → any logged-in user can read all quotes | Drop that policy. Keep the role/permission-gated one. |
| `contact_submissions` | Same `auth.role() = 'authenticated'` leak | Drop that policy. Keep the role/permission-gated one. |
| `bookings` | Same `auth.role() = 'authenticated'` leak + duplicate `Admin full access bookings` with `USING true` | Drop both leaky policies. Keep `Admins have full control` + `Permitted users can update/view`. |
| `faqs` | RLS not enabled on table | `ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;` (existing public SELECT policy already in place) |

These are pure policy drops/enables — no data is touched.

---

## What this plan deliberately does NOT do

- ❌ No new triggers (existing flow uses RPCs, not triggers — adding triggers would create the exact "duplicate automation" risk the spec warns about)
- ❌ No changes to `generate_invoice_number()` or invoice-number format
- ❌ No schema migration on `bookings`, `invoices`, `receipts` columns — all required snapshot columns (`line_items`, `subtotal`, `tax_amount`, `total_amount`, `source`, `paid_at`) **already exist**
- ❌ No edits to `quote_drafts` flow — drafts remain the prep workspace; once the quote is approved and converted, the snapshot is frozen on the booking row by the RPC
- ❌ No backfill of historical data
- ❌ No renames, no removed columns, no UI restructure

---

## Order of execution (single migration + 4 file edits)

1. **Migration (DB):**
   - Create `receipt_number_seq` + `generate_receipt_number()` function
   - Drop the 3 leaky RLS policies on `quote_requests`, `contact_submissions`, `bookings`
   - Enable RLS on `faqs`
2. **Code:**
   - `createInvoiceFromBooking.ts` → RPC call
   - `QuotesAdmin.tsx` `convertToBooking` → RPC call
   - `InvoicesAdmin.tsx` mark-paid path → `mark_invoice_paid` RPC
   - `BookingsAdmin.tsx` → hide "Generate Invoice" when `source='quote'`

All idempotent. Safe to re-run. No data migration. No downtime.

---

## Verification after deploy

- Convert an existing quote twice → second click returns the same booking (no duplicate)
- Click "Generate Invoice" twice on a manual booking → second click returns the same invoice
- Mark an invoice paid → receipt row appears with `BR-RC-YYYY-####` number; clicking again returns the same receipt
- Quote-sourced booking detail page → "Generate Invoice" button is hidden; "View Invoice" shown instead
- Logged-in non-admin without permissions → cannot read other users' quotes/bookings/messages
