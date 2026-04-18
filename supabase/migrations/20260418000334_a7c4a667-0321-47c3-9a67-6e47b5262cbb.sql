-- Add nullable service_type_id columns (no FK so deleting a service preserves history)
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_type_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS service_type_id uuid;

-- Backfill from existing name strings
UPDATE public.quote_requests qr
SET service_type_id = st.id
FROM public.service_types st
WHERE qr.service_type_id IS NULL
  AND qr.service_type IS NOT NULL
  AND lower(qr.service_type) = lower(st.name);

UPDATE public.quote_drafts qd
SET service_type_id = st.id
FROM public.service_types st
WHERE qd.service_type_id IS NULL
  AND qd.service_type IS NOT NULL
  AND lower(qd.service_type) = lower(st.name);

UPDATE public.bookings b
SET service_type_id = st.id
FROM public.service_types st
WHERE b.service_type_id IS NULL
  AND b.service_type IS NOT NULL
  AND lower(b.service_type) = lower(st.name);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_quote_requests_service_type_id ON public.quote_requests(service_type_id);
CREATE INDEX IF NOT EXISTS idx_quote_drafts_service_type_id ON public.quote_drafts(service_type_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_type_id ON public.bookings(service_type_id);
CREATE INDEX IF NOT EXISTS idx_invoices_service_type_id ON public.invoices(service_type_id);