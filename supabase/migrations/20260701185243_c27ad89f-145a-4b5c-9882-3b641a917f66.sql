-- ============================================================
-- 1. Remove anon time-window SELECT policies (PII exposure)
-- ============================================================
DROP POLICY IF EXISTS "Anon can read own just-inserted booking" ON public.bookings;
DROP POLICY IF EXISTS "Anon can read own just-inserted quote" ON public.quote_requests;
DROP POLICY IF EXISTS "Anon can read own just-inserted contact" ON public.contact_submissions;

-- ============================================================
-- 2. Remove anon INSERT on notifications (handled by triggers now)
-- ============================================================
DROP POLICY IF EXISTS "Public can insert notifications" ON public.notifications;

-- ============================================================
-- 3. Replace "always true" public INSERT policies with validation
-- ============================================================
-- bookings
DROP POLICY IF EXISTS "Allow public booking creation" ON public.bookings;
CREATE POLICY "Allow public booking creation" ON public.bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
    AND email IS NOT NULL AND length(email) <= 254
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

-- contact_submissions (consolidate 3 duplicate policies into 1 validated policy)
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
DROP POLICY IF EXISTS "Public Insert Contacts" ON public.contact_submissions;
DROP POLICY IF EXISTS "Public can submit contact form" ON public.contact_submissions;
CREATE POLICY "Public can submit contact form" ON public.contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
    AND email IS NOT NULL AND length(email) <= 254
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND message IS NOT NULL AND length(message) BETWEEN 1 AND 5000
  );

-- quote_requests (consolidate 2 duplicate policies into 1 validated policy)
DROP POLICY IF EXISTS "Anyone can submit quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Public can submit quotes" ON public.quote_requests;
CREATE POLICY "Public can submit quotes" ON public.quote_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
    AND email IS NOT NULL AND length(email) <= 254
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

-- cleaner_applications
DROP POLICY IF EXISTS "Anyone can submit cleaner applications" ON public.cleaner_applications;
CREATE POLICY "Anyone can submit cleaner applications" ON public.cleaner_applications
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL AND length(btrim(full_name)) BETWEEN 1 AND 200
    AND email IS NOT NULL AND length(email) <= 254
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

-- ============================================================
-- 4. Server-side notification creation (replaces anon insert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admins_on_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_ref_type text;
  v_message text;
BEGIN
  IF TG_TABLE_NAME = 'bookings' THEN
    v_type := 'booking'; v_ref_type := 'booking';
    v_message := 'New booking from ' || COALESCE(NEW.name, 'Unknown')
                 || COALESCE(' for ' || NULLIF(btrim(NEW.service_type), ''), '');
  ELSIF TG_TABLE_NAME = 'quote_requests' THEN
    v_type := 'quote'; v_ref_type := 'quote';
    v_message := 'New quote request from ' || COALESCE(NEW.name, 'Unknown');
  ELSIF TG_TABLE_NAME = 'contact_submissions' THEN
    v_type := 'contact'; v_ref_type := 'contact';
    v_message := 'New contact from ' || COALESCE(NEW.name, 'Unknown');
  ELSIF TG_TABLE_NAME = 'cleaner_applications' THEN
    v_type := 'cleaner_application'; v_ref_type := 'cleaner_application';
    v_message := 'New cleaner application from ' || COALESCE(NEW.full_name, 'Unknown');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (type, message, reference_id, reference_type, user_id)
  VALUES (v_type, v_message, NEW.id, v_ref_type, NULL);

  RETURN NEW;
END;
$$;

-- Trigger functions should never be directly callable via the API
REVOKE ALL ON FUNCTION public.notify_admins_on_submission() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admins_on_submission() FROM anon;
REVOKE ALL ON FUNCTION public.notify_admins_on_submission() FROM authenticated;

DROP TRIGGER IF EXISTS trg_notify_new_booking ON public.bookings;
CREATE TRIGGER trg_notify_new_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_submission();

DROP TRIGGER IF EXISTS trg_notify_new_quote ON public.quote_requests;
CREATE TRIGGER trg_notify_new_quote
  AFTER INSERT ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_submission();

DROP TRIGGER IF EXISTS trg_notify_new_contact ON public.contact_submissions;
CREATE TRIGGER trg_notify_new_contact
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_submission();

DROP TRIGGER IF EXISTS trg_notify_new_application ON public.cleaner_applications;
CREATE TRIGGER trg_notify_new_application
  AFTER INSERT ON public.cleaner_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_submission();

-- ============================================================
-- 5. Fix mutable search_path on create_receipt
-- ============================================================
ALTER FUNCTION public.create_receipt(p_invoice_id uuid) SET search_path = public;

-- ============================================================
-- 6. Revoke anon EXECUTE on privileged SECURITY DEFINER functions
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, numeric, text, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.convert_quote_to_booking(uuid, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_invoice_from_booking(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_invoice_paid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_contact_activity(uuid, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_display_names(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_receipt(uuid) FROM anon;

-- ============================================================
-- 7. Storage: stop public listing + protect quote attachments
-- ============================================================
-- Remove broad public read (allowed enumeration/listing of the public bucket)
DROP POLICY IF EXISTS "Anyone can view site images" ON storage.objects;
DROP POLICY IF EXISTS "Public view for gallery" ON storage.objects;
-- Remove anon drop-off into the public bucket (quotes moved to a private bucket)
DROP POLICY IF EXISTS "Public drop-off for quotes" ON storage.objects;

-- Private quote-attachments bucket policies
CREATE POLICY "Public can upload quote attachments" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'quote-attachments');

CREATE POLICY "Staff can view quote attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'quote-attachments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text))
  );

CREATE POLICY "Staff can delete quote attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-attachments'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_quotes'::text))
  );

-- ============================================================
-- 8. Realtime: remove sensitive PII tables from broadcast feed
-- ============================================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.quote_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE public.contact_submissions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.cleaner_applications;