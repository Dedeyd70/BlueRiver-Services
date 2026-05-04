-- Service areas table for managing serviced ZIP codes
CREATE TABLE public.service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zip text NOT NULL UNIQUE,
  city text NOT NULL DEFAULT 'Bellevue',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active service areas"
  ON public.service_areas FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage service areas"
  ON public.service_areas FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'));

CREATE TRIGGER trg_service_areas_updated
  BEFORE UPDATE ON public.service_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed Bellevue ZIP codes
INSERT INTO public.service_areas (zip, city) VALUES
  ('98004', 'Bellevue'),
  ('98005', 'Bellevue'),
  ('98006', 'Bellevue'),
  ('98007', 'Bellevue'),
  ('98008', 'Bellevue'),
  ('98009', 'Bellevue'),
  ('98015', 'Bellevue')
ON CONFLICT (zip) DO NOTHING;