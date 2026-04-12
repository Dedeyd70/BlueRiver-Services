
-- Add service_category to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_category text NOT NULL DEFAULT 'main';

-- Add selected_addons and total_price to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS selected_addons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price numeric DEFAULT NULL;

-- Add selected_addons to quote_requests
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS selected_addons jsonb DEFAULT '[]'::jsonb;
