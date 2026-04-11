
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
