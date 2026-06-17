-- 1) Realtime for notifications (replaces 30s polling in NotificationBell)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- 5) Forward-looking indexes (negligible now, for scale)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON public.bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_date_status
  ON public.bookings (booking_date, status);

-- 4) Manual, report-first cleanup RPC (admin-gated, dry-run by default)
CREATE OR REPLACE FUNCTION public.cleanup_old_records(
  p_days integer DEFAULT 90,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := now() - make_interval(days => GREATEST(p_days, 1));
  v_notifications integer := 0;
  v_booking_logs integer := 0;
  v_contact_logs integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Sign in required.';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Only admins can run cleanup.';
  END IF;

  IF p_dry_run THEN
    SELECT count(*) INTO v_notifications FROM public.notifications WHERE created_at < v_cutoff;
    SELECT count(*) INTO v_booking_logs FROM public.booking_activity_logs WHERE created_at < v_cutoff;
    SELECT count(*) INTO v_contact_logs FROM public.contact_activity_logs WHERE created_at < v_cutoff;
  ELSE
    WITH d AS (DELETE FROM public.notifications WHERE created_at < v_cutoff RETURNING 1)
      SELECT count(*) INTO v_notifications FROM d;
    WITH d AS (DELETE FROM public.booking_activity_logs WHERE created_at < v_cutoff RETURNING 1)
      SELECT count(*) INTO v_booking_logs FROM d;
    WITH d AS (DELETE FROM public.contact_activity_logs WHERE created_at < v_cutoff RETURNING 1)
      SELECT count(*) INTO v_contact_logs FROM d;
  END IF;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'cutoff', v_cutoff,
    'days', GREATEST(p_days, 1),
    'notifications', v_notifications,
    'booking_activity_logs', v_booking_logs,
    'contact_activity_logs', v_contact_logs
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_old_records(integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_records(integer, boolean) TO authenticated;