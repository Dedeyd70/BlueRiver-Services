-- 1. Update get_booked_slots to also block "completed" slots
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_date date)
 RETURNS TABLE(time_slot text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.time_slot
  FROM public.bookings b
  WHERE b.booking_date = p_date
    AND b.status IN ('pending', 'confirmed', 'completed');
$function$;

-- 2. Update check_slot_overlap to include completed
CREATE OR REPLACE FUNCTION public.check_slot_overlap(p_date date, p_time_slot text, p_exclude_booking uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  proposed tsrange := public.parse_time_slot(p_time_slot);
  conflict_count int;
BEGIN
  IF proposed IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*)
    INTO conflict_count
    FROM bookings b
   WHERE b.booking_date = p_date
     AND b.status IN ('pending', 'confirmed', 'completed')
     AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
     AND public.parse_time_slot(b.time_slot) IS NOT NULL
     AND public.parse_time_slot(b.time_slot) && proposed;

  RETURN conflict_count > 0;
END;
$function$;

-- 3. Dedupe existing overlapping rows: keep newest per (date, slot), cancel older
WITH ranked AS (
  SELECT id, booking_date, time_slot,
         row_number() OVER (PARTITION BY booking_date, time_slot
                            ORDER BY created_at DESC, id DESC) AS rn
    FROM public.bookings
   WHERE status IN ('pending', 'confirmed', 'completed')
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
),
updated AS (
  UPDATE public.bookings b
     SET status = 'cancelled',
         notes = COALESCE(b.notes || E'\n', '') ||
                 '[auto-cancelled ' || to_char(now(), 'YYYY-MM-DD HH24:MI') ||
                 ' — duplicate slot resolved by conflict lockdown migration]'
   WHERE b.id IN (SELECT id FROM losers)
  RETURNING b.id, b.status
)
INSERT INTO public.booking_activity_logs (booking_id, action, details, new_status, created_at)
SELECT id, 'cancelled',
       'Auto-cancelled by conflict lockdown migration (duplicate slot, kept newest).',
       'cancelled', now()
  FROM updated;

-- 4. Recreate unique partial index to include all three statuses
DROP INDEX IF EXISTS public.idx_unique_confirmed_booking_slot;
CREATE UNIQUE INDEX idx_unique_confirmed_booking_slot
  ON public.bookings (booking_date, time_slot)
  WHERE status IN ('pending', 'confirmed', 'completed');