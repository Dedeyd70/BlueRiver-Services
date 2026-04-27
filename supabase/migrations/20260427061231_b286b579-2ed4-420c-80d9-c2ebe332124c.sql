
-- 1. Receipt number generator (missing function referenced by create_receipt RPC)
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

-- 2. Drop leaky RLS policies (any authenticated user could read all rows)
DROP POLICY IF EXISTS "Admin can view quotes" ON public.quote_requests;
DROP POLICY IF EXISTS "Admin full access quotes" ON public.quote_requests;

DROP POLICY IF EXISTS "Admin can view contact submissions" ON public.contact_submissions;
DROP POLICY IF EXISTS "Admin full access contacts" ON public.contact_submissions;

DROP POLICY IF EXISTS "Admin can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admin full access bookings" ON public.bookings;

-- 3. Enable RLS on faqs (public SELECT policy already exists)
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
