ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS full_bathrooms integer,
  ADD COLUMN IF NOT EXISTS half_bathrooms integer,
  ADD COLUMN IF NOT EXISTS living_rooms integer,
  ADD COLUMN IF NOT EXISTS office_rooms integer,
  ADD COLUMN IF NOT EXISTS floor_type text,
  ADD COLUMN IF NOT EXISTS property_size text,
  ADD COLUMN IF NOT EXISTS has_cabinets boolean,
  ADD COLUMN IF NOT EXISTS is_empty_property boolean;