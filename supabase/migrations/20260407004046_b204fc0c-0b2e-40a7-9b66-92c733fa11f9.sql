
-- Add manager and staff roles to the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Add category column to gallery table
ALTER TABLE public.gallery ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Add service_id to before_after_images for linking to services
ALTER TABLE public.before_after_images ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;
