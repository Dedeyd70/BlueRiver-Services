
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
