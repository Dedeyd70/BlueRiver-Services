-- 1. Bookings: public inserts cannot forge payment/status
DROP POLICY IF EXISTS "Allow public booking creation" ON public.bookings;
CREATE POLICY "Allow public booking creation" ON public.bookings
FOR INSERT TO anon, authenticated
WITH CHECK (
  name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
  AND email IS NOT NULL AND length(email) <= 254
  AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND status = 'pending'
  AND (payment_status IS NULL OR payment_status = 'unpaid')
  AND paid_at IS NULL
  AND COALESCE(subtotal, 0) >= 0
  AND COALESCE(tax_amount, 0) >= 0
  AND COALESCE(total_amount, 0) >= 0
  AND COALESCE(total_price, 0) >= 0
  AND cancellation_reason IS NULL
);

-- 2. Cleaner applications: public cannot self-approve
DROP POLICY IF EXISTS "Anyone can submit cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Anyone can submit cleaner applications" ON public.cleaner_applications
FOR INSERT TO anon, authenticated
WITH CHECK (
  full_name IS NOT NULL AND length(btrim(full_name)) BETWEEN 1 AND 200
  AND email IS NOT NULL AND length(email) <= 254
  AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND status = 'new'
  AND admin_notes IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
);

-- 3. Contact submissions: public cannot set status/admin notes
DROP POLICY IF EXISTS "Public can submit contact form" ON public.contact_submissions;
CREATE POLICY "Public can submit contact form" ON public.contact_submissions
FOR INSERT TO anon, authenticated
WITH CHECK (
  name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
  AND email IS NOT NULL AND length(email) <= 254
  AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND message IS NOT NULL AND length(message) BETWEEN 1 AND 5000
  AND status = 'new'
  AND admin_notes IS NULL
);

-- 4. Quote requests: public cannot set workflow status
DROP POLICY IF EXISTS "Public can submit quotes" ON public.quote_requests;
CREATE POLICY "Public can submit quotes" ON public.quote_requests
FOR INSERT TO anon, authenticated
WITH CHECK (
  name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
  AND email IS NOT NULL AND length(email) <= 254
  AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND status = 'requested'
  AND close_reason IS NULL
);

-- 5. Resume uploads: scope to the applications/ prefix, no overwrites of other paths
DROP POLICY IF EXISTS "Anyone can upload a cleaner resume" ON storage.objects;
CREATE POLICY "Anyone can upload a cleaner resume" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'cleaner-resumes'
  AND (storage.foldername(name))[1] = 'applications'
  AND array_length(storage.foldername(name), 1) = 1
  AND length(name) <= 200
);

-- 6. Permission registry: admins/staff with any admin role only
DROP POLICY IF EXISTS "Authenticated read registry" ON public.permission_registry;
CREATE POLICY "Staff can read registry" ON public.permission_registry
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR public.has_role(auth.uid(), 'staff'::app_role)
);

-- 7. SECURITY DEFINER function execute grants: remove blanket PUBLIC grants,
--    grant anon only to the genuinely public-facing helpers.
REVOKE ALL ON FUNCTION public.check_recent_submission(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_booked_slots(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_review(uuid, text, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_slot_overlap(date, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_recent_submission(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, text, integer, text, text) TO anon, authenticated, service_role;
-- required by RLS policies evaluated for both anon and authenticated
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_slot_overlap(date, text, uuid) TO authenticated, service_role;

-- Admin/staff-only RPCs: no anonymous access at all
REVOKE ALL ON FUNCTION public.cleanup_old_records(integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_invoice_payment(uuid, numeric, text, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_quote_to_booking(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_invoice_from_booking(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_display_names(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_contact_activity(uuid, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_invoice_paid(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.notify_admins_on_submission() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cleanup_old_records(integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, numeric, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_booking(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_booking(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_display_names(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_contact_activity(uuid, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) TO authenticated, service_role;