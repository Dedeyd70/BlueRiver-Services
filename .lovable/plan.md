# Fix `relation "receipts" does not exist` on remote push

## Problem
The migration `20260701215524_9e732593-0dd9-49ac-9534-aedfd0402a71.sql` fails at the `create_receipt` statement with:
```
ERROR: relation "receipts" does not exist (SQLSTATE 42P01)
```
`create_receipt` declares `existing_receipt receipts%ROWTYPE` and inserts into `receipts`. PL/pgSQL resolves those table references when the function is **created**, so the `receipts` table must already exist. It does not exist on your remote database because `receipts` (like `create_receipt` itself) was originally created via the SQL editor, never through a migration file. It has never appeared in any of the migration files.

## Fix
Edit `supabase/migrations/20260701215524_9e732593-0dd9-49ac-9534-aedfd0402a71.sql` and insert an **idempotent** `receipts` table block right after the sequence (line 5), before `generate_receipt_number` / `create_receipt`. Using `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF EXISTS` makes it safe on the dev DB (where the table already exists) and on remote (where it's missing).

The table definition mirrors the current dev schema exactly:

```sql
CREATE TABLE IF NOT EXISTS public.receipts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text,
  invoice_id     uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payment_date   timestamp without time zone,
  amount_paid    numeric,
  line_items     jsonb DEFAULT '[]'::jsonb,
  created_at     timestamp without time zone DEFAULT now()
);

-- receipts is written/read only by SECURITY DEFINER functions
-- (mark_invoice_paid / confirm_invoice_payment), never via PostgREST.
GRANT ALL ON public.receipts TO service_role;

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage receipts" ON public.receipts;
CREATE POLICY "Admins can manage receipts"
ON public.receipts FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
```

This exactly matches the live table: columns `id, receipt_number, invoice_id, payment_date, amount_paid, line_items, created_at`, RLS enabled, admin-only access. The frontend never queries `receipts` directly (only through RPCs), so no `anon`/`authenticated` grants are needed.

## Order in the file (after edit)
1. `CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq` (existing, line 5)
2. **NEW:** `CREATE TABLE IF NOT EXISTS public.receipts ...` + GRANT + RLS + policy
3. `generate_receipt_number()` (existing)
4. `create_receipt()` (existing — now compiles because the table exists)
5. `REVOKE EXECUTE ... FROM anon` (existing)

## Prerequisite / note
- This assumes the `invoices` table already exists on remote (the FK references it, and `create_receipt` reads `invoices%ROWTYPE`). Your earlier errors were only about `receipts`, which indicates `invoices` is present. If the remote push then reports `invoices` missing, that's a separate, larger gap I'd address next.
- No behavior change on dev: `IF NOT EXISTS` skips creation where the table already exists; the policy is re-created identically.

## Result
- The migration runs cleanly on remote (table created, then function compiles).
- No changes needed to the dev database — it's idempotent.
