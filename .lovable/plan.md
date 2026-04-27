## Goal
Make the database trigger `set_invoice_number` the **single source of truth** for `invoice_number`. Remove the conflicting manual call from the RPC. Confirm frontend never sets it.

## Audit results (current state)

**✅ Database trigger exists and is enabled**
- `set_invoice_number` BEFORE INSERT on `public.invoices` → calls `generate_invoice_number()`
- Function format: `BR-YYYY-####` from `invoice_number_seq`
- Column `invoice_number text UNIQUE` already on the table
- **Will not be touched.**

**❌ RPC `create_invoice_from_booking` violates the rule**
The current function body contains:
```sql
INSERT INTO invoices (id, invoice_number, booking_id, ...)
VALUES (gen_random_uuid(), generate_invoice_number(), ...)
```
This is broken on two counts:
1. It **manually computes** `invoice_number` (rule violation).
2. `generate_invoice_number()` is a **trigger function** (returns `trigger`, references `NEW`). Calling it as a scalar function will raise an error at runtime — this is why "Mark Completed" has been failing.

**✅ Frontend is already clean**
Confirmed by `rg`:
- `src/lib/createInvoiceFromBooking.ts` — only calls the RPC, no `invoice_number` in payload.
- `src/pages/admin/InvoicesAdmin.tsx` — manual invoice insert payload does **not** include `invoice_number`. It only reads it for display.
- `src/pages/admin/BookingsAdmin.tsx` — only reads `invoice.invoice_number` for toasts/notifications.
- `src/lib/invoicePdf.ts` — only reads it for the PDF.
- `src/integrations/supabase/types.ts` — auto-generated; not edited.

No frontend changes are required.

## Changes

### 1. Database migration (single migration file)

Replace the body of `create_invoice_from_booking` so the INSERT omits `invoice_number` entirely. The trigger will populate it.

```sql
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    existing_invoice invoices%ROWTYPE;
    booking_record   bookings%ROWTYPE;
    new_invoice_id   uuid;
BEGIN
    -- Idempotent: reuse existing invoice for this booking
    SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_invoice);
    END IF;

    SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- NOTE: invoice_number is intentionally OMITTED.
    -- The BEFORE INSERT trigger `set_invoice_number` populates it.
    INSERT INTO invoices (
        id, booking_id, quote_id,
        customer_name, customer_email,
        line_items, services,
        subtotal, tax, tax_amount, total, total_amount,
        payment_status, status,
        invoice_date, issued_date, created_at
    )
    VALUES (
        gen_random_uuid(),
        booking_record.id,
        booking_record.quote_id,
        COALESCE(booking_record.name, 'Customer'),
        COALESCE(booking_record.email, ''),
        COALESCE(booking_record.line_items, '[]'::jsonb),
        COALESCE(booking_record.line_items, '[]'::jsonb),
        COALESCE(booking_record.subtotal, booking_record.total_price, 0),
        COALESCE(booking_record.tax_amount, 0),
        COALESCE(booking_record.tax_amount, 0),
        COALESCE(booking_record.total_amount, booking_record.total_price, 0),
        COALESCE(booking_record.total_amount, booking_record.total_price, 0),
        'unpaid',
        'draft',
        CURRENT_DATE,
        CURRENT_DATE,
        now()
    )
    RETURNING id INTO new_invoice_id;

    RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;
```

Why the extra columns (`customer_name`, `customer_email`, `services`, `issued_date`, etc.): these are `NOT NULL` on the `invoices` table per the schema audit. The previous RPC body would also fail RLS/NOT NULL checks even if the numbering bug were fixed. Including them is required for the INSERT to succeed and is **not** related to numbering.

### 2. No frontend changes
Already compliant. No edits to:
- `src/lib/createInvoiceFromBooking.ts`
- `src/pages/admin/InvoicesAdmin.tsx`
- `src/pages/admin/BookingsAdmin.tsx`

## Verification after deploy
1. Call `create_invoice_from_booking` for a booking with no existing invoice → returns invoice with `invoice_number = 'BR-YYYY-####'`.
2. Call it again for the same booking → returns the **same** invoice (idempotent), no new number consumed.
3. Insert a manual invoice via `InvoicesAdmin` → `invoice_number` is auto-populated by the trigger.
4. `SELECT invoice_number, COUNT(*) FROM invoices GROUP BY 1 HAVING COUNT(*) > 1` → zero rows (UNIQUE enforced).
5. `SELECT COUNT(*) FROM invoices WHERE invoice_number IS NULL` → zero.

## Rules respected
- ✅ Trigger untouched
- ✅ Numbering format/sequence untouched
- ✅ No `invoice_number` in any frontend INSERT
- ✅ No `invoice_number` in the RPC INSERT
- ✅ Single source of truth = `set_invoice_number` trigger