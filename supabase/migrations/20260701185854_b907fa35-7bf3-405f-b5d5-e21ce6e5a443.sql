-- Allow anonymous + authenticated visitors to upload quote attachments.
DROP POLICY IF EXISTS "Anyone can upload quote attachments" ON storage.objects;
CREATE POLICY "Anyone can upload quote attachments"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'quote-attachments');

-- Allow signed-in staff to read (and thus sign URLs for) quote attachments.
DROP POLICY IF EXISTS "Staff can read quote attachments" ON storage.objects;
CREATE POLICY "Staff can read quote attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-attachments'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
);