GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT INSERT ON public.quote_requests TO anon, authenticated;
GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT SELECT (id) ON public.bookings TO anon;
GRANT SELECT (id) ON public.quote_requests TO anon;
GRANT SELECT (id) ON public.contact_submissions TO anon;