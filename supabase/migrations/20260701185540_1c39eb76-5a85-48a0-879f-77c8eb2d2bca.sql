-- Remove the leftover PUBLIC (and anon) EXECUTE grants on privileged functions.
-- These are admin/staff operations and must never be callable by anonymous visitors.
REVOKE EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, numeric, text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.convert_quote_to_booking(uuid, date, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_booking(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_contact_activity(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_receipt(uuid) FROM PUBLIC, anon;

-- Stop enumeration/listing of the public images bucket.
-- Public URLs keep working (public buckets serve objects directly without RLS),
-- so gallery and site imagery still display; only the "list all files" API is closed.
DROP POLICY IF EXISTS "Admin view all" ON storage.objects;