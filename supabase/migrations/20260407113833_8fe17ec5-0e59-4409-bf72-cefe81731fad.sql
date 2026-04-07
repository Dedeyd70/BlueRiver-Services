
-- Add quote_notes table for interaction/activity log
CREATE TABLE public.quote_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quote notes"
  ON public.quote_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage quote notes"
  ON public.quote_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff can manage quote notes"
  ON public.quote_notes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'staff'::app_role));

-- Add homepage_images table for admin-managed homepage images
CREATE TABLE public.homepage_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  image_url text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage homepage images"
  ON public.homepage_images FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view homepage images"
  ON public.homepage_images FOR SELECT
  TO public
  USING (true);

-- Add delete policy for contact_submissions
CREATE POLICY "Admins can delete submissions"
  ON public.contact_submissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add delete policies for bookings and quotes
CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete quotes"
  ON public.quote_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed default homepage image sections
INSERT INTO public.homepage_images (section_key, label) VALUES
  ('hero', 'Hero Background Image'),
  ('cta_banner', 'Call to Action Banner')
ON CONFLICT (section_key) DO NOTHING;
