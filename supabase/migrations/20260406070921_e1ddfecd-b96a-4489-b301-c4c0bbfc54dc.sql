
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
