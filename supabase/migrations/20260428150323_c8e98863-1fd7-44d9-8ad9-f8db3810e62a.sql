CREATE POLICY "Anon can read own just-inserted booking"
  ON public.bookings FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

CREATE POLICY "Anon can read own just-inserted quote"
  ON public.quote_requests FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

CREATE POLICY "Anon can read own just-inserted contact"
  ON public.contact_submissions FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');