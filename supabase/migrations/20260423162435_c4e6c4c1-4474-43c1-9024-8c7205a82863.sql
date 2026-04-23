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