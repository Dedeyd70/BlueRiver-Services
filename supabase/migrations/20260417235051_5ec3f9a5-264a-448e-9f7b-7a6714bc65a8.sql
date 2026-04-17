ALTER TABLE public.service_fields DROP CONSTRAINT IF EXISTS service_fields_service_type_id_fkey;
ALTER TABLE public.service_pricing_rules DROP CONSTRAINT IF EXISTS service_pricing_rules_service_type_id_fkey;

ALTER TABLE public.service_fields
  ADD CONSTRAINT service_fields_service_type_id_fkey
  FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) ON DELETE CASCADE;

ALTER TABLE public.service_pricing_rules
  ADD CONSTRAINT service_pricing_rules_service_type_id_fkey
  FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) ON DELETE CASCADE;