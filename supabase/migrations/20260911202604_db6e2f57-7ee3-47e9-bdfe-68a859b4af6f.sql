DROP POLICY IF EXISTS "Public can submit contact form" ON public.contact_submissions;
CREATE POLICY "Public can submit contact form" ON public.contact_submissions
FOR INSERT TO anon, authenticated
WITH CHECK (
  name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200
  AND email IS NOT NULL AND length(email) <= 254
  AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  AND message IS NOT NULL AND length(message) BETWEEN 1 AND 5000
  AND status = 'pending'
  AND admin_notes IS NULL
);