-- 1. Create service_fields table
CREATE TABLE public.service_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  input_type text NOT NULL DEFAULT 'number',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_type_id, field_key)
);

ALTER TABLE public.service_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service fields"
  ON public.service_fields FOR SELECT
  USING (true);

CREATE POLICY "Admins manage service fields"
  ON public.service_fields FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_service_fields_updated_at
  BEFORE UPDATE ON public.service_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_service_fields_service_type ON public.service_fields(service_type_id, display_order);

-- 2. Add custom_fields to quote_requests
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Seed default fields for every existing service_type
INSERT INTO public.service_fields (service_type_id, field_key, label, input_type, required, display_order)
SELECT st.id, v.field_key, v.label, 'number', false, v.ord
FROM public.service_types st
CROSS JOIN (VALUES
  ('bedrooms', 'Bedrooms', 1),
  ('full_bathrooms', 'Full Bathrooms', 2),
  ('half_bathrooms', 'Half Bathrooms', 3),
  ('kitchen_count', 'Kitchens', 4),
  ('living_rooms', 'Living Rooms', 5),
  ('office_rooms', 'Office Rooms', 6)
) AS v(field_key, label, ord)
ON CONFLICT (service_type_id, field_key) DO NOTHING;