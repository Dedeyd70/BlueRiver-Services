
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
