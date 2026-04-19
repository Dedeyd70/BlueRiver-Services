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