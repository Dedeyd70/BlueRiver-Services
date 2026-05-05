ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS tax_applies boolean NOT NULL DEFAULT false;
UPDATE public.service_types SET tax_applies = true WHERE name ILIKE '%commercial%';
UPDATE public.service_types SET tax_applies = false WHERE name NOT ILIKE '%commercial%';