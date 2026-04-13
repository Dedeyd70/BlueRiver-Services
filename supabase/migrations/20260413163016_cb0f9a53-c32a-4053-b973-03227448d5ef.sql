
-- Function: get booked time slots for a date (safe public access)
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date date)
RETURNS TABLE(time_slot text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.time_slot
  FROM public.bookings b
  WHERE b.booking_date = p_date
    AND b.status IN ('pending', 'confirmed');
$$;

-- Function: check if same email submitted recently (rate limiting)
CREATE OR REPLACE FUNCTION public.check_recent_submission(p_email text, p_table text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent boolean;
BEGIN
  IF p_table = 'bookings' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.bookings
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSIF p_table = 'quote_requests' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.quote_requests
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSIF p_table = 'contact_submissions' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.contact_submissions
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSE
    recent := false;
  END IF;
  RETURN recent;
END;
$$;
