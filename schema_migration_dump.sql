-- ============================================================
-- Migration: 20260331212127_b8a4de50-13c5-49a4-81f8-00e42e8e8291.sql
-- ============================================================


-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Site settings (key-value store)
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  features TEXT[] NOT NULL DEFAULT '{}',
  price_starting TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active services" ON public.services FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can read all services" ON public.services FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage services" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Testimonials
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  rating INT NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active testimonials" ON public.testimonials FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can read all testimonials" ON public.testimonials FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage testimonials" ON public.testimonials FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Page content
CREATE TABLE public.page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT NOT NULL,
  section_key TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page_name, section_key)
);
ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read page content" ON public.page_content FOR SELECT USING (true);
CREATE POLICY "Admins can manage page content" ON public.page_content FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Contact submissions
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service_type TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit contact form" ON public.contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view submissions" ON public.contact_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update submissions" ON public.contact_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_testimonials_updated_at BEFORE UPDATE ON public.testimonials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_page_content_updated_at BEFORE UPDATE ON public.page_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contact_submissions_updated_at BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- Migration: 20260403004402_c3bb3368-4d94-4a2c-b54a-bdf8de0ea146.sql
-- ============================================================


-- Create gallery table
CREATE TABLE public.gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active gallery images" ON public.gallery
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can manage gallery" ON public.gallery
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all gallery" ON public.gallery
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add image_url to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

-- Create storage bucket for site images
INSERT INTO storage.buckets (id, name, public) VALUES ('site-images', 'site-images', true);

-- Storage policies
CREATE POLICY "Anyone can view site images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'site-images');

CREATE POLICY "Admins can upload site images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete site images" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin')
  );


-- ============================================================
-- Migration: 20260405031241_24a47fd6-ca3a-4099-93ca-44970c9a3c45.sql
-- ============================================================


-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  service_type TEXT,
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create bookings" ON public.bookings FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage bookings" ON public.bookings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Quote requests table (separate from contact_submissions)
CREATE TABLE public.quote_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  service_type TEXT,
  description TEXT NOT NULL,
  preferred_contact TEXT DEFAULT 'email',
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit quote requests" ON public.quote_requests FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view all quotes" ON public.quote_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage quotes" ON public.quote_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Availability settings (working days, hours, time slot duration)
CREATE TABLE public.availability_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.availability_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read availability" ON public.availability_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage availability" ON public.availability_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Blocked dates
CREATE TABLE public.blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocked dates" ON public.blocked_dates FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage blocked dates" ON public.blocked_dates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insert default availability settings
INSERT INTO public.availability_settings (setting_key, setting_value) VALUES
  ('working_days', '{"days": [1, 2, 3, 4, 5, 6]}'),
  ('working_hours', '{"start": "07:00", "end": "19:00"}'),
  ('time_slot_duration', '{"minutes": 60}'),
  ('saturday_hours', '{"start": "08:00", "end": "17:00"}');

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;


-- ============================================================
-- Migration: 20260406070921_e1ddfecd-b96a-4489-b301-c4c0bbfc54dc.sql
-- ============================================================


-- Before & After gallery table
CREATE TABLE public.before_after_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.before_after_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active before_after" ON public.before_after_images
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Admins can read all before_after" ON public.before_after_images
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage before_after" ON public.before_after_images
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Branding settings table
CREATE TABLE public.branding_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read branding" ON public.branding_settings
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage branding" ON public.branding_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));


-- ============================================================
-- Migration: 20260407004046_b204fc0c-0b2e-40a7-9b66-92c733fa11f9.sql
-- ============================================================


-- Add manager and staff roles to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Add category column to gallery table
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Add service_id to before_after_images for linking to services
ALTER TABLE public.before_after_images ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;


-- ============================================================
-- Migration: 20260407113833_8fe17ec5-0e59-4409-bf72-cefe81731fad.sql
-- ============================================================


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


-- ============================================================
-- Migration: 20260411194430_39da2bc4-48a6-41cf-a0bb-b0a2ebdf88fe.sql
-- ============================================================


-- Add new columns to gallery table
ALTER TABLE public.gallery
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS image_type text NOT NULL DEFAULT 'single';

-- Add constraint for image_type values
ALTER TABLE public.gallery
  ADD CONSTRAINT gallery_image_type_check CHECK (image_type IN ('single', 'before', 'after'));

-- Migrate before_after_images data into gallery
DO $$
DECLARE
  rec RECORD;
  gid uuid;
  max_order integer;
BEGIN
  SELECT COALESCE(MAX(display_order), 0) INTO max_order FROM public.gallery;
  
  FOR rec IN SELECT * FROM public.before_after_images ORDER BY display_order LOOP
    gid := gen_random_uuid();
    max_order := max_order + 1;
    
    -- Insert "before" image
    INSERT INTO public.gallery (image_url, caption, category, is_active, display_order, group_id, image_type)
    VALUES (rec.before_image_url, rec.caption, 'Deep Cleaning', rec.is_active, max_order, gid, 'before');
    
    max_order := max_order + 1;
    
    -- Insert "after" image
    INSERT INTO public.gallery (image_url, caption, category, is_active, display_order, group_id, image_type)
    VALUES (rec.after_image_url, rec.caption, 'Deep Cleaning', rec.is_active, max_order, gid, 'after');
  END LOOP;
END $$;

-- Drop the old table
DROP TABLE IF EXISTS public.before_after_images;


-- ============================================================
-- Migration: 20260412012654_c864f6c5-4bfd-40b8-8da2-0a7393a8f390.sql
-- ============================================================


-- Add service_category to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_category text NOT NULL DEFAULT 'main';

-- Add selected_addons and total_price to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS selected_addons jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_price numeric DEFAULT NULL;

-- Add selected_addons to quote_requests
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS selected_addons jsonb DEFAULT '[]'::jsonb;


-- ============================================================
-- Migration: 20260413131230_76f91246-a9f9-45cc-b221-fc29234d540f.sql
-- ============================================================


-- Create notifications table for admin notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admins/managers/staff can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins/managers/staff can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Allow system inserts (for triggers or edge functions) - admin can insert for any user
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Also allow anon inserts so public booking/quote forms can trigger notifications
CREATE POLICY "Public can insert notifications"
ON public.notifications
FOR INSERT
TO anon
WITH CHECK (true);

-- Seed booking_approval_mode setting if not exists
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES ('booking_approval_mode', 'auto')
ON CONFLICT (setting_key) DO NOTHING;


-- ============================================================
-- Migration: 20260413131359_7fb88429-3f1a-46c6-9bc5-b271bdfd0f7c.sql
-- ============================================================


-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Allow admin/manager/staff to see all notifications
CREATE POLICY "Admin roles can view all notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
);

-- Drop and recreate update policy to allow admin roles to update any notification
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Admin roles can update notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'staff'::app_role)
);

-- Make user_id nullable (already is from CREATE TABLE, but confirm)
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;


-- ============================================================
-- Migration: 20260413135710_e694f6ea-e9c9-46a3-b891-6b83c3ff5c0e.sql
-- ============================================================


-- Invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  notes TEXT,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles can view invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin roles can insert invoices"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin roles can update invoices"
  ON public.invoices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Unique partial index to prevent double-booking confirmed slots
CREATE UNIQUE INDEX idx_unique_confirmed_booking_slot
  ON public.bookings (booking_date, time_slot)
  WHERE status IN ('confirmed', 'pending');


-- ============================================================
-- Migration: 20260413163016_cb0f9a53-c32a-4053-b973-03227448d5ef.sql
-- ============================================================


-- Function: get booked time slots for a date (safe public access)
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date date)
RETURNS TABLE(time_slot text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.time_slot
  FROM public.bookings b
  WHERE b.booking_date = p_date
    AND b.status IN ('pending', 'confirmed');
$$;

-- Function: check if same email submitted recently (rate limiting)
CREATE OR REPLACE FUNCTION public.check_recent_submission(p_email text, p_table text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent boolean;
BEGIN
  IF p_table = 'bookings' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.bookings
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSIF p_table = 'quote_requests' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.quote_requests
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSIF p_table = 'contact_submissions' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.contact_submissions
      WHERE email = p_email AND created_at > now() - interval '60 seconds'
    ) INTO recent;
  ELSE
    recent := false;
  END IF;
  RETURN recent;
END;
$$;


-- ============================================================
-- Migration: 20260414165239_eae41b05-5ff4-4946-9790-61ab37696ba9.sql
-- ============================================================

ALTER TABLE public.bookings ADD COLUMN cancellation_reason text;

-- ============================================================
-- Migration: 20260417161643_9f438567-3bf2-4fcb-9aa1-4065ea35ae32.sql
-- ============================================================

-- Add quote_id link to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL;

-- Add close_reason to quote_requests
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS close_reason text;

-- Invoice number sequence + columns
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0;

-- Function + trigger to auto-generate invoice numbers like INV-YYYY-0001
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER set_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();

-- ============================================================
-- Migration: 20260417164146_9c1ff7d3-bf51-4a4d-baae-9096f65fde5d.sql
-- ============================================================

ALTER TABLE public.quote_requests ALTER COLUMN status SET DEFAULT 'requested';

-- ============================================================
-- Migration: 20260417170727_ce5d6e4c-b953-459a-bcdd-6f614fdee630.sql
-- ============================================================

CREATE TABLE public.quote_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL UNIQUE REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  service_type text,
  scope text,
  base_price numeric NOT NULL DEFAULT 0,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  notes text,
  validity_days integer NOT NULL DEFAULT 7,
  prepared_by uuid,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quote drafts"
  ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage quote drafts"
  ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff can manage quote drafts"
  ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER update_quote_drafts_updated_at
  BEFORE UPDATE ON public.quote_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quote_drafts_quote_id ON public.quote_drafts(quote_id);

-- ============================================================
-- Migration: 20260417183838_63238aec-99b4-4b36-92ee-63c8c1dea15e.sql
-- ============================================================

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS kitchen_count integer,
  ADD COLUMN IF NOT EXISTS condition_level text;

ALTER TABLE public.quote_drafts
  ADD COLUMN IF NOT EXISTS condition_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS manual_adjustment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- Migration: 20260417190547_19990d93-801d-4350-972d-a13206ac3230.sql
-- ============================================================

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS full_bathrooms integer,
  ADD COLUMN IF NOT EXISTS half_bathrooms integer,
  ADD COLUMN IF NOT EXISTS living_rooms integer,
  ADD COLUMN IF NOT EXISTS office_rooms integer,
  ADD COLUMN IF NOT EXISTS floor_type text,
  ADD COLUMN IF NOT EXISTS property_size text,
  ADD COLUMN IF NOT EXISTS has_cabinets boolean,
  ADD COLUMN IF NOT EXISTS is_empty_property boolean;

-- ============================================================
-- Migration: 20260417204407_81543c13-8895-4b41-bd72-b791d83a8a94.sql
-- ============================================================

-- 1. service_types
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read service types" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "Admins manage service types" ON public.service_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_service_types_updated BEFORE UPDATE ON public.service_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. service_pricing_rules
CREATE TABLE public.service_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  unit_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_type_id, category)
);
ALTER TABLE public.service_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pricing rules" ON public.service_pricing_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage pricing rules" ON public.service_pricing_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_pricing_rules_updated BEFORE UPDATE ON public.service_pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. condition_settings
CREATE TABLE public.condition_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  surcharge_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.condition_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read conditions" ON public.condition_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage conditions" ON public.condition_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_condition_settings_updated BEFORE UPDATE ON public.condition_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.condition_settings (name, surcharge_amount) VALUES
  ('Light', 0), ('Standard', 20), ('Heavy', 50), ('Post-Renovation', 100);

-- Seed service_types from existing main services
INSERT INTO public.service_types (name, base_price)
SELECT title, COALESCE(NULLIF(regexp_replace(COALESCE(price_starting,'0'), '[^0-9]', '', 'g'), '')::int, 0)
FROM public.services
WHERE service_category = 'main' AND is_active = true
ON CONFLICT (name) DO NOTHING;

-- Seed default pricing rules per service
INSERT INTO public.service_pricing_rules (service_type_id, category, unit_price)
SELECT st.id, cat, 0
FROM public.service_types st
CROSS JOIN (VALUES ('Bedroom'),('Bathroom'),('FullBath'),('HalfBath'),('Kitchen'),('LivingRoom'),('OfficeRoom')) AS c(cat)
ON CONFLICT (service_type_id, category) DO NOTHING;

-- 4. quote_drafts.line_items
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5. Update invoice number prefix to BR-
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'BR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- Migration: 20260417213927_8dcedf4f-c13f-4a7b-93f8-ed39d8918572.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260417235051_5ec3f9a5-264a-448e-9f7b-7a6714bc65a8.sql
-- ============================================================

ALTER TABLE public.service_fields DROP CONSTRAINT IF EXISTS service_fields_service_type_id_fkey;
ALTER TABLE public.service_pricing_rules DROP CONSTRAINT IF EXISTS service_pricing_rules_service_type_id_fkey;

ALTER TABLE public.service_fields
  ADD CONSTRAINT service_fields_service_type_id_fkey
  FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) ON DELETE CASCADE;

ALTER TABLE public.service_pricing_rules
  ADD CONSTRAINT service_pricing_rules_service_type_id_fkey
  FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) ON DELETE CASCADE;

-- ============================================================
-- Migration: 20260418000334_a7c4a667-0321-47c3-9a67-6e47b5262cbb.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260418002928_fc114761-8fe8-477e-951d-b64f8337c93f.sql
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_invoices_service_type_id ON public.invoices(service_type_id);

-- ============================================================
-- Migration: 20260419003315_4e7808b9-ec29-46ae-bad4-43038c9d4005.sql
-- ============================================================

-- 1. Permission registry
CREATE TABLE public.permission_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Per-user grants on existing user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Dynamic social links
CREATE TABLE public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL,
  url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_social_links_updated_at
BEFORE UPDATE ON public.social_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SECURITY DEFINER permission check
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR (permissions ->> _key)::boolean = true)
  )
$$;

-- 5. RLS — registry
ALTER TABLE public.permission_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read registry" ON public.permission_registry
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage registry" ON public.permission_registry
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 6. RLS — social_links
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active socials" ON public.social_links
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins read all socials" ON public.social_links
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Permitted users manage socials" ON public.social_links
  FOR ALL TO authenticated
  USING (has_permission(auth.uid(),'can_manage_socials'))
  WITH CHECK (has_permission(auth.uid(),'can_manage_socials'));

-- 7. LOGIN FIX — let users read their own role row
CREATE POLICY "Users can read their own role"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 8. Seed registry
INSERT INTO public.permission_registry (key,label,description) VALUES
  ('can_manage_socials','Manage Social Links','Add/edit/delete social media links'),
  ('can_edit_pricing','Edit Pricing','Change service prices and rules'),
  ('can_publish_gallery','Publish Gallery','Add/remove gallery items'),
  ('can_manage_legal','Manage Legal Pages','Edit legal/policy content')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Migration: 20260419015655_70a0fef0-1a4f-4138-9351-9473c3fd94b4.sql
-- ============================================================

-- 1. Seed operational permission keys
INSERT INTO public.permission_registry (key, label, description) VALUES
  ('can_manage_bookings',    'Manage Bookings',    'View and manage bookings'),
  ('can_manage_quotes',      'Manage Quotes',      'View and manage quote requests'),
  ('can_manage_messages',    'Manage Messages',    'View and manage contact submissions'),
  ('can_manage_settings',    'Manage Settings',    'View and manage site settings'),
  ('can_manage_gallery',     'Manage Gallery',     'View and manage gallery images'),
  ('can_manage_testimonials','Manage Testimonials','View and manage testimonials')
ON CONFLICT (key) DO NOTHING;

-- 2. Permission-aware RLS (admin OR has_permission). Existing admin-only policies stay.
CREATE POLICY "Permitted users can view bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_bookings'));

CREATE POLICY "Permitted users can view contact_submissions"
  ON public.contact_submissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_messages'));

CREATE POLICY "Permitted users can manage site_settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'));

CREATE POLICY "Permitted users can manage gallery"
  ON public.gallery FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_gallery'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_gallery'));

CREATE POLICY "Permitted users can manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_testimonials'));

-- 3. Realtime publication for dashboard reactivity
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_submissions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.bookings            REPLICA IDENTITY FULL;
ALTER TABLE public.quote_requests      REPLICA IDENTITY FULL;
ALTER TABLE public.contact_submissions REPLICA IDENTITY FULL;

-- ============================================================
-- Migration: 20260419023429_72603482-662e-4eb1-b97e-01d15e09c296.sql
-- ============================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

-- ============================================================
-- Migration: 20260419050845_272a9fbc-e0a1-4b41-8b37-02c8b91d7d31.sql
-- ============================================================

INSERT INTO public.permission_registry (key, label, description) VALUES
  ('can_manage_business_rules', 'Manage Business Rules', 'Edit booking auto-approval and tax rate'),
  ('can_manage_site_content', 'Manage Site Content', 'Edit homepage, about, footer copy and stats')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Migration: 20260419061933_0214d155-d390-4722-a1fc-0c6c82e0bfcf.sql
-- ============================================================

-- Drop any prior duplicates from earlier attempts (safe if absent)
DROP POLICY IF EXISTS "Permitted users manage availability" ON public.availability_settings;
DROP POLICY IF EXISTS "Permitted users manage blocked dates" ON public.blocked_dates;

CREATE POLICY "Permitted users manage availability"
ON public.availability_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_edit_availability'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_edit_availability'));

CREATE POLICY "Permitted users manage blocked dates"
ON public.blocked_dates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_edit_availability'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_edit_availability'));

-- ============================================================
-- Migration: 20260419174918_a53df2e0-78f1-4bdb-a263-869cf39483c3.sql
-- ============================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================
-- Migration: 20260423162435_c4e6c4c1-4474-43c1-9024-8c7205a82863.sql
-- ============================================================

-- 1. Add property fields to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS floor_type text,
  ADD COLUMN IF NOT EXISTS pet_count integer,
  ADD COLUMN IF NOT EXISTS condition_level text,
  ADD COLUMN IF NOT EXISTS is_empty_property boolean DEFAULT false;

-- 2. Add pet_count to quote_requests
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS pet_count integer;

-- 3. Add payment reconciliation fields to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- 4. Create booking_activity_logs table
CREATE TABLE IF NOT EXISTS public.booking_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL,
  action text NOT NULL,
  details text,
  previous_status text,
  new_status text,
  actor_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_activity_logs_booking_id
  ON public.booking_activity_logs(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_activity_logs_created_at
  ON public.booking_activity_logs(created_at DESC);

ALTER TABLE public.booking_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles can view booking activity"
  ON public.booking_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_permission(auth.uid(), 'can_manage_bookings'::text)
  );

CREATE POLICY "Admin roles can insert booking activity"
  ON public.booking_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_permission(auth.uid(), 'can_manage_bookings'::text)
  );

-- ============================================================
-- Migration: 20260426005033_a20c76a2-c053-45d7-b658-21e631533edc.sql
-- ============================================================

-- Permitted users can update quote_requests
CREATE POLICY "Permitted users can update quotes"
ON public.quote_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_permission(auth.uid(),'can_manage_quotes')
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_permission(auth.uid(),'can_manage_quotes')
);

-- Permitted users can update bookings
CREATE POLICY "Permitted users can update bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_permission(auth.uid(),'can_manage_bookings')
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_permission(auth.uid(),'can_manage_bookings')
);

-- Permitted users can update contact_submissions
CREATE POLICY "Permitted users can update contact_submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_permission(auth.uid(),'can_manage_messages')
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_permission(auth.uid(),'can_manage_messages')
);

-- ============================================================
-- Migration: 20260427061231_b286b579-2ed4-420c-80d9-c2ebe332124c.sql
-- ============================================================


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


-- ============================================================
-- Migration: 20260427071222_cbcc15f0-f94e-44f2-8958-03df41aaf24e.sql
-- ============================================================


CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    existing_invoice invoices%ROWTYPE;
    booking_record   bookings%ROWTYPE;
    new_invoice_id   uuid;
BEGIN
    -- Idempotent: reuse existing invoice for this booking
    SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_invoice);
    END IF;

    SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- NOTE: invoice_number is intentionally OMITTED.
    -- The BEFORE INSERT trigger `set_invoice_number` populates it.
    INSERT INTO invoices (
        id, booking_id, quote_id,
        customer_name, customer_email,
        line_items, services,
        subtotal, tax, tax_amount, total, total_amount,
        payment_status, status,
        invoice_date, issued_date, created_at
    )
    VALUES (
        gen_random_uuid(),
        booking_record.id,
        booking_record.quote_id,
        COALESCE(booking_record.name, 'Customer'),
        COALESCE(booking_record.email, ''),
        COALESCE(booking_record.line_items, '[]'::jsonb),
        COALESCE(booking_record.line_items, '[]'::jsonb),
        COALESCE(booking_record.subtotal, booking_record.total_price, 0),
        COALESCE(booking_record.tax_amount, 0),
        COALESCE(booking_record.tax_amount, 0),
        COALESCE(booking_record.total_amount, booking_record.total_price, 0),
        COALESCE(booking_record.total_amount, booking_record.total_price, 0),
        'unpaid',
        'draft',
        CURRENT_DATE,
        CURRENT_DATE,
        now()
    )
    RETURNING id INTO new_invoice_id;

    RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;


-- ============================================================
-- Migration: 20260427152038_8160d108-b531-4624-bcad-78a82ce1d2c3.sql
-- ============================================================

-- 1. Fix create_invoice_from_booking — remove reference to nonexistent `status` column
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    existing_invoice invoices%ROWTYPE;
    booking_record   bookings%ROWTYPE;
    new_invoice_id   uuid;
BEGIN
    SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_invoice);
    END IF;

    SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- invoice_number is populated by the BEFORE INSERT trigger `set_invoice_number`.
    INSERT INTO invoices (
        id, booking_id, quote_id,
        customer_name, customer_email,
        line_items, services,
        subtotal, tax, tax_amount, total, total_amount,
        payment_status,
        issued_date, created_at
    )
    VALUES (
        gen_random_uuid(),
        booking_record.id,
        booking_record.quote_id,
        COALESCE(booking_record.name, 'Customer'),
        COALESCE(booking_record.email, ''),
        COALESCE(booking_record.line_items, '[]'::jsonb),
        COALESCE(booking_record.line_items, '[]'::jsonb),
        COALESCE(booking_record.subtotal, booking_record.total_price, 0),
        COALESCE(booking_record.tax_amount, 0),
        COALESCE(booking_record.tax_amount, 0),
        COALESCE(booking_record.total_amount, booking_record.total_price, 0),
        COALESCE(booking_record.total_amount, booking_record.total_price, 0),
        'unpaid',
        CURRENT_DATE,
        now()
    )
    RETURNING id INTO new_invoice_id;

    RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- 2. Fix mark_invoice_paid — drop the nonexistent `status` column from UPDATE
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    updated_invoice invoices%ROWTYPE;
BEGIN
    UPDATE invoices
    SET
        payment_status = 'paid',
        paid_at = now()
    WHERE id = p_invoice_id
    RETURNING * INTO updated_invoice;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    PERFORM create_receipt(updated_invoice.id);

    RETURN to_jsonb(updated_invoice);
END;
$function$;

-- 3. Fix convert_quote_to_booking — tag source='quote' on creation
CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(p_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    existing_booking bookings%ROWTYPE;
    quote_record quote_requests%ROWTYPE;
    new_booking_id uuid;
BEGIN
    SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_booking);
    END IF;

    SELECT * INTO quote_record FROM quote_requests WHERE id = p_quote_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    INSERT INTO bookings (
        id,
        quote_id,
        service_type_id,
        line_items,
        total_price,
        source,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        quote_record.id,
        quote_record.service_type_id,
        quote_record.line_items,
        quote_record.total,
        'quote',
        now()
    )
    RETURNING id INTO new_booking_id;

    RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_booking_id);
END;
$function$;

-- 4. Backfill: bookings with no quote link should be classified as 'manual'.
UPDATE public.bookings
SET source = 'manual'
WHERE quote_id IS NULL
  AND (source IS NULL OR source = 'quote');

-- ============================================================
-- Migration: 20260427202237_6f92b0be-7110-4042-bea9-5a0f408c61f6.sql
-- ============================================================


-- 5c.1 — convert_quote_to_booking: read snapshot from quote_drafts, hardcode pending + quote source, gate by permission
CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_booking bookings%ROWTYPE;
  quote_record     quote_requests%ROWTYPE;
  draft_record     quote_drafts%ROWTYPE;
  new_booking_id   uuid;
  v_line_items     jsonb := '[]'::jsonb;
  v_subtotal       numeric := 0;
  v_tax            numeric := 0;
  v_total          numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_quotes')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Quotes permission to convert this quote.';
  END IF;

  SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_booking);
  END IF;

  SELECT * INTO quote_record FROM quote_requests WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO draft_record FROM quote_drafts WHERE quote_id = p_quote_id;
  IF FOUND THEN
    v_line_items := COALESCE(draft_record.line_items, '[]'::jsonb);
    v_subtotal   := COALESCE((draft_record.breakdown->>'subtotal')::numeric, 0);
    v_tax        := COALESCE((draft_record.breakdown->>'tax_amount')::numeric, 0);
    v_total      := COALESCE((draft_record.breakdown->>'total')::numeric, 0);
  END IF;

  INSERT INTO bookings (
    id, quote_id, service_type_id,
    line_items, subtotal, tax_amount, total_amount, total_price,
    source, status, created_at
  )
  VALUES (
    gen_random_uuid(), quote_record.id, quote_record.service_type_id,
    v_line_items, v_subtotal, v_tax, v_total, v_total,
    'quote', 'pending', now()
  )
  RETURNING id INTO new_booking_id;

  RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_booking_id);
END;
$$;

-- 5c.2 — create_invoice_from_booking: SECURITY DEFINER + permission gate
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to generate invoices.';
  END IF;

  SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_invoice);
  END IF;

  SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email,
    line_items, services,
    subtotal, tax, tax_amount, total, total_amount,
    payment_status,
    issued_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.subtotal, booking_record.total_price, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    'unpaid',
    CURRENT_DATE,
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$$;

-- 5c.3 — mark_invoice_paid: SECURITY DEFINER + permission gate
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_invoice invoices%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to mark invoices as paid.';
  END IF;

  UPDATE invoices
     SET payment_status = 'paid',
         paid_at = now()
   WHERE id = p_invoice_id
  RETURNING * INTO updated_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  PERFORM public.create_receipt(updated_invoice.id);

  RETURN to_jsonb(updated_invoice);
END;
$$;

-- 5c.4 — Register Manage Invoices permission (idempotent)
INSERT INTO public.permission_registry (key, label, description)
SELECT 'can_manage_invoices', 'Manage Invoices', 'Generate, send, and mark invoices as paid'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_registry WHERE key = 'can_manage_invoices'
);


-- ============================================================
-- Migration: 20260427210955_ebc2b642-5535-4041-9860-983e841867b5.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.convert_quote_to_booking(uuid);
DROP FUNCTION IF EXISTS public.convert_quote_to_booking(uuid, date, text);

CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(
  p_quote_id     uuid,
  p_booking_date date,
  p_time_slot    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_booking bookings%ROWTYPE;
  q  quote_requests%ROWTYPE;
  d  quote_drafts%ROWTYPE;
  new_id uuid;
  v_line_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_quotes')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Quotes permission to convert this quote.';
  END IF;

  SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_booking);
  END IF;

  SELECT * INTO q FROM quote_requests WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO d FROM quote_drafts WHERE quote_id = p_quote_id;
  IF FOUND THEN
    v_line_items := COALESCE(d.line_items, '[]'::jsonb);
    v_subtotal   := COALESCE((d.breakdown->>'subtotal')::numeric, 0);
    v_tax        := COALESCE((d.breakdown->>'tax_amount')::numeric, 0);
    v_total      := COALESCE((d.breakdown->>'total')::numeric, 0);
  END IF;

  INSERT INTO bookings (
    id, quote_id, service_type_id, service_type,
    name, email, phone, address,
    booking_date, time_slot,
    notes, consent_given,
    property_type, square_footage, bedrooms, bathrooms,
    frequency, floor_type, condition_level,
    is_empty_property, has_pets, pet_count, entry_codes,
    selected_addons, custom_fields,
    line_items, subtotal, tax_amount, total_amount, total_price,
    source, status, created_at
  ) VALUES (
    gen_random_uuid(), q.id, q.service_type_id, q.service_type,
    COALESCE(NULLIF(q.name, ''), 'Customer'),
    COALESCE(NULLIF(q.email, ''), ''),
    q.phone,
    COALESCE(NULLIF(q.address, ''), 'Address on file'),
    p_booking_date, p_time_slot,
    q.description, COALESCE(q.consent_given, false),
    q.property_type, q.square_footage, q.bedrooms, q.bathrooms,
    q.frequency, q.floor_type, q.condition_level,
    COALESCE(q.is_empty_property, false), COALESCE(q.has_pets, false), q.pet_count, q.entry_codes,
    COALESCE(q.selected_addons, '[]'::jsonb), COALESCE(q.custom_fields, '{}'::jsonb),
    v_line_items, v_subtotal, v_tax, v_total, v_total,
    'quote', 'pending', now()
  )
  RETURNING id INTO new_id;

  UPDATE quote_requests SET status = 'converted', updated_at = now() WHERE id = p_quote_id;

  RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_id);
END;
$$;

-- ============================================================
-- Migration: 20260428144116_91db9f9a-b28b-4f2c-85aa-c7fe5748b41f.sql
-- ============================================================

GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT INSERT ON public.quote_requests TO anon, authenticated;
GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT SELECT (id) ON public.bookings TO anon;
GRANT SELECT (id) ON public.quote_requests TO anon;
GRANT SELECT (id) ON public.contact_submissions TO anon;

-- ============================================================
-- Migration: 20260428150323_c8e98863-1fd7-44d9-8ad9-f8db3810e62a.sql
-- ============================================================

CREATE POLICY "Anon can read own just-inserted booking"
  ON public.bookings FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

CREATE POLICY "Anon can read own just-inserted quote"
  ON public.quote_requests FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

CREATE POLICY "Anon can read own just-inserted contact"
  ON public.contact_submissions FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

-- ============================================================
-- Migration: 20260430144136_b9834cd4-b0ae-4d30-9b5e-2844ca2ad9c0.sql
-- ============================================================

UPDATE public.condition_settings SET name = 'Post-Construction' WHERE name = 'Post-Renovation';
UPDATE public.service_types  SET name  = 'Recurring Cleaning' WHERE name  = 'Reccuring Cleaning';
UPDATE public.services       SET title = 'Recurring Cleaning' WHERE title = 'Reccuring Cleaning';
UPDATE public.bookings       SET service_type = 'Recurring Cleaning' WHERE service_type = 'Reccuring Cleaning';
UPDATE public.quote_requests SET service_type = 'Recurring Cleaning' WHERE service_type = 'Reccuring Cleaning';
DELETE FROM public.service_pricing_rules
 WHERE category IN ('Bedroom','Bathroom','FullBath','HalfBath','Kitchen','LivingRoom','OfficeRoom')
   AND unit_price = 0;

-- ============================================================
-- Migration: 20260430215430_a92abf37-bff7-4778-a758-647d83ac45f4.sql
-- ============================================================

ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================
-- Migration: 20260502105837_cbc17de6-abd5-4901-ab3f-9524cfbf8011.sql
-- ============================================================


-- ============================================================
-- 1. Public-read RLS on pricing_multipliers
-- ============================================================
DROP POLICY IF EXISTS "Public can read active multipliers" ON public.pricing_multipliers;
CREATE POLICY "Public can read active multipliers"
  ON public.pricing_multipliers
  FOR SELECT
  TO public
  USING (is_active = true);

-- ============================================================
-- 2. Invoices schema additions: address column
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS address text;

-- ============================================================
-- 3. Replace create_invoice_from_booking RPC to copy
--    address, tax_rate (from site_settings), and due_date (+14d)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
  v_tax_rate       numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to generate invoices.';
  END IF;

  SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_invoice);
  END IF;

  SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Pull current tax rate from site_settings (string -> numeric)
  SELECT COALESCE(NULLIF(setting_value, '')::numeric, 0)
    INTO v_tax_rate
    FROM site_settings
   WHERE setting_key = 'tax_rate'
   LIMIT 1;
  IF v_tax_rate IS NULL THEN v_tax_rate := 0; END IF;

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email, address,
    line_items, services,
    subtotal, tax, tax_amount, tax_rate, total, total_amount,
    payment_status,
    issued_date, due_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    booking_record.address,
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.subtotal, booking_record.total_price, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    v_tax_rate,
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    'unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- ============================================================
-- 4. Identity resolution: get_admin_display_names(uuid[])
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Any authenticated staff can resolve admin display names.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
    SELECT u.id AS user_id,
           COALESCE(
             NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
             NULLIF(u.email, ''),
             'Admin user'
           )::text AS display_name
      FROM auth.users u
     WHERE u.id = ANY(_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_display_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_display_names(uuid[]) TO authenticated;

-- ============================================================
-- 5. Scheduling overlap: parse slot strings to a timerange
--    and detect overlaps for a given date.
-- ============================================================
CREATE OR REPLACE FUNCTION public.parse_time_slot(p_slot text)
RETURNS tsrange
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := trim(coalesce(p_slot, ''));
  parts text[];
  start_t time;
  end_t   time;
  base date := DATE '2000-01-01';
BEGIN
  IF s = '' THEN
    RETURN NULL;
  END IF;

  -- Range form: "7:00 AM - 11:00 AM"
  IF position(' - ' in s) > 0 OR position('-' in s) > 0 THEN
    parts := regexp_split_to_array(s, '\s*-\s*');
    IF array_length(parts, 1) = 2 THEN
      BEGIN
        start_t := parts[1]::time;
        end_t   := parts[2]::time;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      RETURN tsrange(base + start_t, base + end_t, '[)');
    END IF;
  END IF;

  -- Single time form: "23:00", "9:07", "7:00AM"
  BEGIN
    start_t := s::time;
    -- Treat single-time slots as 1-hour blocks for overlap purposes.
    RETURN tsrange(base + start_t, base + start_t + INTERVAL '1 hour', '[)');
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_slot_overlap(
  p_date date,
  p_time_slot text,
  p_exclude_booking uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposed tsrange := public.parse_time_slot(p_time_slot);
  conflict_count int;
BEGIN
  IF proposed IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)
    INTO conflict_count
    FROM bookings b
   WHERE b.booking_date = p_date
     AND b.status IN ('pending', 'confirmed')
     AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
     AND public.parse_time_slot(b.time_slot) IS NOT NULL
     AND public.parse_time_slot(b.time_slot) && proposed;

  RETURN conflict_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_slot_overlap(date, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_time_slot(text) TO anon, authenticated;


-- ============================================================
-- Migration: 20260502110142_45417ad6-cc1d-41a1-86b1-c9cb30b5201a.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.parse_time_slot(p_slot text)
RETURNS tsrange
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text := trim(coalesce(p_slot, ''));
  parts text[];
  start_t time;
  end_t   time;
  base date := DATE '2000-01-01';
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  IF position(' - ' in s) > 0 OR position('-' in s) > 0 THEN
    parts := regexp_split_to_array(s, '\s*-\s*');
    IF array_length(parts, 1) = 2 THEN
      BEGIN
        start_t := parts[1]::time;
        end_t   := parts[2]::time;
      EXCEPTION WHEN OTHERS THEN RETURN NULL;
      END;
      RETURN tsrange(base + start_t, base + end_t, '[)');
    END IF;
  END IF;
  BEGIN
    start_t := s::time;
    RETURN tsrange(base + start_t, base + start_t + INTERVAL '1 hour', '[)');
  EXCEPTION WHEN OTHERS THEN RETURN NULL;
  END;
END;
$$;

-- ============================================================
-- Migration: 20260502123411_008c5c52-ba52-4365-8b17-3589c0068a0f.sql
-- ============================================================

-- Phase 1: Update invoice due date to 7 days; add booking date guard

CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
  v_tax_rate       numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to generate invoices.';
  END IF;

  SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_invoice);
  END IF;

  SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT COALESCE(NULLIF(setting_value, '')::numeric, 0)
    INTO v_tax_rate
    FROM site_settings
   WHERE setting_key = 'tax_rate'
   LIMIT 1;
  IF v_tax_rate IS NULL THEN v_tax_rate := 0; END IF;

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email, address,
    line_items, services,
    subtotal, tax, tax_amount, tax_rate, total, total_amount,
    payment_status,
    issued_date, due_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    booking_record.address,
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.subtotal, booking_record.total_price, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    v_tax_rate,
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    'unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- Server-side No-Backdating guard for bookings.
-- Triggered on INSERT and on UPDATE of booking_date.
-- Allows historical rows to remain (only checks NEW value when it changes).
CREATE OR REPLACE FUNCTION public.enforce_booking_date_not_past()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.booking_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'BACKDATING_NOT_ALLOWED: Bookings cannot be scheduled in the past.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.booking_date IS DISTINCT FROM OLD.booking_date
       AND NEW.booking_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'BACKDATING_NOT_ALLOWED: Bookings cannot be rescheduled to a past date.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_date_not_past ON public.bookings;
CREATE TRIGGER trg_enforce_booking_date_not_past
BEFORE INSERT OR UPDATE OF booking_date ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_date_not_past();

-- ============================================================
-- Migration: 20260503015212_c6b7f6c9-8fe1-4245-8987-2471efc27cc0.sql
-- ============================================================

-- 1. Update get_booked_slots to also block "completed" slots
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date date)
 RETURNS TABLE(time_slot text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.time_slot
  FROM public.bookings b
  WHERE b.booking_date = p_date
    AND b.status IN ('pending', 'confirmed', 'completed');
$function$;

-- 2. Update check_slot_overlap to include completed
CREATE OR REPLACE FUNCTION public.check_slot_overlap(p_date date, p_time_slot text, p_exclude_booking uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  proposed tsrange := public.parse_time_slot(p_time_slot);
  conflict_count int;
BEGIN
  IF proposed IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)
    INTO conflict_count
    FROM bookings b
   WHERE b.booking_date = p_date
     AND b.status IN ('pending', 'confirmed', 'completed')
     AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
     AND public.parse_time_slot(b.time_slot) IS NOT NULL
     AND public.parse_time_slot(b.time_slot) && proposed;

  RETURN conflict_count > 0;
END;
$function$;

-- 3. Dedupe existing overlapping rows: keep newest per (date, slot), cancel older
WITH ranked AS (
  SELECT id, booking_date, time_slot,
         row_number() OVER (PARTITION BY booking_date, time_slot
                            ORDER BY created_at DESC, id DESC) AS rn
    FROM public.bookings
   WHERE status IN ('pending', 'confirmed', 'completed')
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
),
updated AS (
  UPDATE public.bookings b
     SET status = 'cancelled',
         notes = COALESCE(b.notes || E'\n', '') ||
                 '[auto-cancelled ' || to_char(now(), 'YYYY-MM-DD HH24:MI') ||
                 ' — duplicate slot resolved by conflict lockdown migration]'
   WHERE b.id IN (SELECT id FROM losers)
  RETURNING b.id, b.status
)
INSERT INTO public.booking_activity_logs (booking_id, action, details, new_status, created_at)
SELECT id, 'cancelled',
       'Auto-cancelled by conflict lockdown migration (duplicate slot, kept newest).',
       'cancelled', now()
  FROM updated;

-- 4. Recreate unique partial index to include all three statuses
DROP INDEX IF EXISTS public.idx_unique_confirmed_booking_slot;
CREATE UNIQUE INDEX idx_unique_confirmed_booking_slot
  ON public.bookings (booking_date, time_slot)
  WHERE status IN ('pending', 'confirmed', 'completed');

-- ============================================================
-- Migration: 20260503034917_573e61bb-dac5-4e5c-8efe-a12a277e0728.sql
-- ============================================================


-- 1. Allow anon/auth to call the rate-limit RPC (fixes Contact 403)
GRANT EXECUTE ON FUNCTION public.check_recent_submission(text, text) TO anon, authenticated;

-- 2. Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_booking ON public.reviews(booking_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read public reviews"
  ON public.reviews FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_manage_testimonials'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_manage_testimonials'));

-- 3. submit_review RPC: verifies booking + email, status=completed
CREATE OR REPLACE FUNCTION public.submit_review(
  p_booking_id uuid,
  p_email text,
  p_rating int,
  p_comment text,
  p_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b bookings%ROWTYPE;
  new_id uuid;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'INVALID_RATING';
  END IF;

  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF lower(trim(b.email)) <> lower(trim(coalesce(p_email, ''))) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH';
  END IF;

  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'BOOKING_NOT_COMPLETED';
  END IF;

  INSERT INTO reviews (booking_id, customer_name, rating, comment, is_public)
  VALUES (p_booking_id, COALESCE(NULLIF(trim(p_name), ''), b.name, 'Customer'), p_rating, NULLIF(trim(p_comment), ''), false)
  ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        customer_name = EXCLUDED.customer_name
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('id', new_id, 'ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, text, int, text, text) TO anon, authenticated;

-- 4. Improve create_invoice_from_booking with line_items fallback totals
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
  v_tax_rate       numeric := 0;
  v_subtotal       numeric := 0;
  v_total          numeric := 0;
  v_li_total       numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to generate invoices.';
  END IF;

  SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_invoice);
  END IF;

  SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT COALESCE(NULLIF(setting_value, '')::numeric, 0)
    INTO v_tax_rate
    FROM site_settings
   WHERE setting_key = 'tax_rate'
   LIMIT 1;
  IF v_tax_rate IS NULL THEN v_tax_rate := 0; END IF;

  -- Compute fallback total from line_items
  SELECT COALESCE(SUM(
    COALESCE((li->>'total_price')::numeric,
             (COALESCE((li->>'quantity')::numeric, 1) * COALESCE((li->>'unit_price')::numeric, (li->>'price')::numeric, 0)))
  ), 0)
  INTO v_li_total
  FROM jsonb_array_elements(COALESCE(booking_record.line_items, '[]'::jsonb)) li;

  v_subtotal := COALESCE(NULLIF(booking_record.subtotal, 0), NULLIF(booking_record.total_price, 0), v_li_total, 0);
  v_total    := COALESCE(NULLIF(booking_record.total_amount, 0), NULLIF(booking_record.total_price, 0), v_li_total, 0);

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email, address,
    line_items, services,
    subtotal, tax, tax_amount, tax_rate, total, total_amount,
    payment_status,
    issued_date, due_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    booking_record.address,
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    v_subtotal,
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    v_tax_rate,
    v_total,
    v_total,
    'unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- 5. Backfill existing invoices with $0 totals from their line_items
UPDATE invoices i
SET total_amount = sub.li_total,
    total = sub.li_total,
    subtotal = CASE WHEN i.subtotal = 0 THEN sub.li_total ELSE i.subtotal END
FROM (
  SELECT id,
    COALESCE(SUM(
      COALESCE((li->>'total_price')::numeric,
               (COALESCE((li->>'quantity')::numeric, 1) * COALESCE((li->>'unit_price')::numeric, (li->>'price')::numeric, 0)))
    ), 0) AS li_total
  FROM invoices, jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) li
  GROUP BY id
) sub
WHERE i.id = sub.id
  AND COALESCE(i.total_amount, 0) = 0
  AND sub.li_total > 0;


-- ============================================================
-- Migration: 20260504172715_7f273f1f-4d81-470b-ab60-f5b773d7762d.sql
-- ============================================================


-- Public stats RPC (counts only, no PII)
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completed_bookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'unique_customers', (SELECT count(DISTINCT lower(trim(email))) FROM bookings WHERE status = 'completed' AND email IS NOT NULL AND email <> ''),
    'avg_rating', COALESCE((SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE is_public = true), 0),
    'public_reviews', (SELECT count(*) FROM reviews WHERE is_public = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- FAQ admin management
DROP POLICY IF EXISTS "Admins manage FAQs" ON public.faqs;
CREATE POLICY "Admins manage FAQs"
ON public.faqs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'));

-- Seed FAQs only if empty
INSERT INTO public.faqs (question, answer, display_order, is_active)
SELECT * FROM (VALUES
  ('Do I need to be home during the cleaning?', 'No. Many of our clients provide entry instructions or a key/code. Our vetted team is fully insured, so you can carry on with your day with peace of mind.', 1, true),
  ('What is included in a deep clean?', 'A deep clean covers everything in a standard clean plus baseboards, interior windows, inside appliances (oven, fridge, microwave on request), detailed bathroom scrubbing, and removal of built-up grime in kitchens.', 2, true),
  ('Do you bring your own supplies and equipment?', 'Yes. We arrive fully equipped with professional-grade, eco-friendly cleaning products and equipment at no extra cost. We can also use your preferred products if you''d prefer.', 3, true),
  ('How do I pay for my cleaning?', 'We accept Cash and Zelle to info@blueriverservices.co. Payment is due upon completion of service unless invoiced separately for recurring or commercial accounts.', 4, true),
  ('What if I''m not satisfied with the cleaning?', 'Your satisfaction is guaranteed. If anything is missed, contact us within 24 hours and we''ll return to make it right at no additional charge.', 5, true)
) AS v(question, answer, display_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.faqs);


-- ============================================================
-- Migration: 20260504174241_7a35acd1-a4cc-44df-9439-e5d3eda3c531.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260504215648_94542969-260f-4a5c-bd0f-0176f09f137c.sql
-- ============================================================


CREATE TABLE IF NOT EXISTS public.contact_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  previous_status text,
  new_status text,
  notes text,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_contact ON public.contact_activity_logs(contact_id, created_at DESC);

ALTER TABLE public.contact_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin roles can view contact activity"
  ON public.contact_activity_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_permission(auth.uid(),'can_manage_messages'));

CREATE POLICY "Admin roles can insert contact activity"
  ON public.contact_activity_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_permission(auth.uid(),'can_manage_messages'));

CREATE OR REPLACE FUNCTION public.log_contact_activity(
  p_contact_id uuid,
  p_action text,
  p_previous_status text DEFAULT NULL,
  p_new_status text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_details text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'staff'::app_role) OR has_permission(auth.uid(),'can_manage_messages')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  INSERT INTO public.contact_activity_logs(contact_id, actor_id, action, previous_status, new_status, notes, details)
  VALUES (p_contact_id, auth.uid(), p_action, p_previous_status, p_new_status, p_notes, p_details)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_contact_activity(uuid,text,text,text,text,text) TO authenticated;

-- Backfill existing admin_notes into activity entries (best-effort)
INSERT INTO public.contact_activity_logs(contact_id, actor_id, action, notes, created_at)
SELECT cs.id, NULL, 'note', cs.admin_notes, cs.updated_at
  FROM public.contact_submissions cs
 WHERE cs.admin_notes IS NOT NULL AND length(trim(cs.admin_notes)) > 0
   AND NOT EXISTS (SELECT 1 FROM public.contact_activity_logs l WHERE l.contact_id = cs.id);


-- ============================================================
-- Migration: 20260505100151_6b3a3f6a-ceab-4454-9c0b-81d54ca36dc9.sql
-- ============================================================


-- 1. Permission bundle registry entries
INSERT INTO public.permission_registry (key, label, description) VALUES
  ('bundle.operations', 'Operations Bundle', 'Bookings, Quotes, Messages, Availability'),
  ('bundle.finance', 'Finance Bundle', 'Invoices, Payments, Pricing'),
  ('bundle.content', 'Content Bundle', 'FAQs, Reviews, Gallery, Site Content, Service Areas'),
  ('bundle.system_admin', 'System Admin Bundle', 'Business Rules, Socials, plus Operations + Finance + Content')
ON CONFLICT (key) DO NOTHING;

-- 2. Allow Operations users to view invoices (read-only); writes still go through RPC.
DROP POLICY IF EXISTS "Operations can view linked invoices" ON public.invoices;
CREATE POLICY "Operations can view linked invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'can_manage_invoices')
    OR has_permission(auth.uid(),'can_manage_bookings')
    OR has_permission(auth.uid(),'can_manage_payment')
  );

-- 3. confirm_invoice_payment RPC (security definer, bypasses RLS).
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  v_new_paid numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Sign in required.';
  END IF;
  IF NOT (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'can_manage_invoices')
    OR has_permission(auth.uid(),'can_manage_payment')
    OR has_permission(auth.uid(),'can_manage_bookings')
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Finance or Operations permission to record payments.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Amount must be greater than zero.';
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;

  v_new_paid := round(coalesce(inv.amount_paid, 0) + p_amount, 2);
  v_status := CASE
    WHEN v_new_paid >= coalesce(inv.total_amount, 0) AND coalesce(inv.total_amount,0) > 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END;

  UPDATE public.invoices SET
    amount_paid = v_new_paid,
    payment_method = p_method,
    payment_date = p_payment_date,
    payment_reference = NULLIF(p_reference, ''),
    payment_status = v_status,
    paid_at = CASE WHEN v_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = p_invoice_id;

  IF v_status = 'paid' THEN
    PERFORM public.create_receipt(p_invoice_id);
  END IF;

  RETURN jsonb_build_object(
    'id', p_invoice_id,
    'payment_status', v_status,
    'amount_paid', v_new_paid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, numeric, text, text, date) TO authenticated;

-- 4. Belt-and-suspenders: ensure Super Admin retains Finance keys explicitly.
UPDATE public.user_roles
SET permissions = COALESCE(permissions, '{}'::jsonb)
  || jsonb_build_object(
       'can_manage_invoices', true,
       'can_manage_payment', true,
       'can_edit_pricing', true
     )
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'joshuaquao@gmail.com');


-- ============================================================
-- Migration: 20260505212053_3df1b8ce-16b6-44d8-b0b9-779aedbd7c92.sql
-- ============================================================

UPDATE public.pricing_multipliers
   SET axis = 'has_pets', key = 'true'
 WHERE id = 'fce05f8d-d9a8-4f73-b03c-e27bdda7c4db';

-- ============================================================
-- Migration: 20260505215800_ecacb7cf-e6ca-4915-be9f-96836db39df4.sql
-- ============================================================

ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS tax_applies boolean NOT NULL DEFAULT false;
UPDATE public.service_types SET tax_applies = true WHERE name ILIKE '%commercial%';
UPDATE public.service_types SET tax_applies = false WHERE name NOT ILIKE '%commercial%';

-- ============================================================
-- Migration: 20260528133901_bec62bf4-61e9-4a1f-9082-a802cf618235.sql
-- ============================================================

-- Create cleaner_applications table for the "Become a Cleaner" recruitment form
CREATE TABLE public.cleaner_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  availability text NOT NULL,
  experience text NOT NULL,
  service_type text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cleaner_applications_service_type_check CHECK (
    service_type IN ('House Cleaning Only', 'Roof Cleaning Only', 'Both House & Roof Cleaning')
  ),
  CONSTRAINT cleaner_applications_status_check CHECK (
    status IN ('new', 'reviewed', 'contacted', 'archived')
  )
);

-- Grants: public can insert (applications), authenticated admins manage
GRANT INSERT ON public.cleaner_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaner_applications TO authenticated;
GRANT ALL ON public.cleaner_applications TO service_role;

-- Enable RLS
ALTER TABLE public.cleaner_applications ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an application
CREATE POLICY "Anyone can submit cleaner applications"
  ON public.cleaner_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins/managers/staff with permission can view
CREATE POLICY "Permitted users can view cleaner applications"
  ON public.cleaner_applications
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'can_manage_applications')
  );

-- Admins/managers/staff with permission can update
CREATE POLICY "Permitted users can update cleaner applications"
  ON public.cleaner_applications
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'can_manage_applications')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_permission(auth.uid(), 'can_manage_applications')
  );

-- Only admins can delete
CREATE POLICY "Admins can delete cleaner applications"
  ON public.cleaner_applications
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER update_cleaner_applications_updated_at
  BEFORE UPDATE ON public.cleaner_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Register the new permission in permission_registry
INSERT INTO public.permission_registry (key, label, description)
VALUES (
  'can_manage_applications',
  'Manage Cleaner Applications',
  'View, update, and triage cleaner job applications submitted via the public Become a Cleaner form.'
)
ON CONFLICT DO NOTHING;

-- APPEND to existing supabase_realtime publication (do NOT drop/recreate)
-- Existing tables in the publication remain untouched.
ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaner_applications;

-- Set REPLICA IDENTITY FULL so realtime emits full row payloads on UPDATE/DELETE
ALTER TABLE public.cleaner_applications REPLICA IDENTITY FULL;

-- ============================================================
-- Migration: 20260528141124_c4cc4a23-c472-4fe9-826b-6650f2d94fee.sql
-- ============================================================

ALTER TABLE public.cleaner_applications
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS has_license BOOLEAN,
  ADD COLUMN IF NOT EXISTS reference_1 TEXT,
  ADD COLUMN IF NOT EXISTS reference_2 TEXT,
  ADD COLUMN IF NOT EXISTS reference_3 TEXT,
  ADD COLUMN IF NOT EXISTS authorized_to_work BOOLEAN,
  ADD COLUMN IF NOT EXISTS personality_bio TEXT;

