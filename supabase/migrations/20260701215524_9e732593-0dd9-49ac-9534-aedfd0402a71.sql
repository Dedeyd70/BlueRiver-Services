-- Idempotently (re)define create_receipt and its dependencies with a fixed
-- search_path. Originally created via the SQL editor, so it may be missing on
-- remote/production databases where ALTER FUNCTION would fail (42883).

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

-- Keep it internal-only (called by mark_invoice_paid / confirm_invoice_payment).
REVOKE EXECUTE ON FUNCTION public.create_receipt(uuid) FROM anon;