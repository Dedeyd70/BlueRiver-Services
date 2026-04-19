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