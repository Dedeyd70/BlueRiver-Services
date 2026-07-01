# Fix `create_receipt` migration failure on remote

## Problem
The migration fails with:
```
ERROR: function public.create_receipt(uuid) does not exist (SQLSTATE 42883)
At statement: ALTER FUNCTION public.create_receipt(p_invoice_id uuid) SET search_path = public
```

`create_receipt` was originally created via the SQL editor, not through a migration file. So it exists in the Lovable Cloud dev database but **does not exist** in the remote/production database you are migrating. `ALTER FUNCTION` requires the function to already exist, so it aborts the whole migration.

Its helpers have the same risk: `generate_receipt_number()` and the sequence `receipt_number_seq` may also be missing remotely.

## Fix
Make the migration self-contained and idempotent by **defining** the function instead of altering it.

In `supabase/migrations/20260701185243_c27ad89f-145a-4b5c-9882-3b641a917f66.sql`, replace section 5:

```sql
-- BEFORE
ALTER FUNCTION public.create_receipt(p_invoice_id uuid) SET search_path = public;
```

with a guaranteed-present definition of the sequence, the number generator, and the function itself — each with `SET search_path = public` built in:

```sql
-- Ensure dependencies exist
CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path TO 'public'
AS $$
  SELECT 'BR-RC-' || to_char(now(),'YYYY') || '-' ||
         lpad(nextval('public.receipt_number_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.create_receipt(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  existing_receipt receipts%ROWTYPE;
  invoice_record   invoices%ROWTYPE;
  new_receipt_id   uuid;
BEGIN
  SELECT * INTO existing_receipt FROM receipts WHERE invoice_id = p_invoice_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_receipt);
  END IF;

  SELECT * INTO invoice_record FROM invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  INSERT INTO receipts (id, receipt_number, invoice_id, payment_date, amount_paid, created_at)
  VALUES (gen_random_uuid(), generate_receipt_number(), invoice_record.id, now(), invoice_record.total, now())
  RETURNING id INTO new_receipt_id;

  RETURN (SELECT to_jsonb(r) FROM receipts r WHERE id = new_receipt_id);
END;
$$;
```

The later `REVOKE EXECUTE ON FUNCTION public.create_receipt(uuid) FROM anon;` (line 137) will now succeed too, since the function is guaranteed to exist by the time it runs.

## Notes / prerequisites
- This assumes the `receipts` and `invoices` tables already exist on the remote DB. If `receipts` is also missing remotely, we'd need to add its `CREATE TABLE` (plus GRANTs and RLS) earlier in the migration — I can confirm whether `receipts` is defined in the migration chain before implementing.
- The definition mirrors the current dev function exactly, so behavior is unchanged; it only guarantees existence + a fixed `search_path`.

## Result
- Migration runs cleanly on any database, whether or not `create_receipt` already existed.
- The "mutable search_path" security finding for `create_receipt` is resolved.
