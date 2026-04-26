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