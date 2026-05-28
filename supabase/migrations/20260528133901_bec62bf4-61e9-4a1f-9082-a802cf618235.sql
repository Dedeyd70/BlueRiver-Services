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