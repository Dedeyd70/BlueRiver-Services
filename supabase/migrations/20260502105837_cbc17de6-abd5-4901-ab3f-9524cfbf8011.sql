
-- ============================================================
-- 1. Public-read RLS on pricing_multipliers
-- ============================================================
DROP POLICY IF EXISTS "Public can read active multipliers" ON public.pricing_multipliers;
CREATE POLICY "Public can read active multipliers"
  ON public.pricing_multipliers
  FOR SELECT
  TO public
  USING (is_active = true);

-- ============================================================
-- 2. Invoices schema additions: address column
-- ============================================================
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS address text;

-- ============================================================
-- 3. Replace create_invoice_from_booking RPC to copy
--    address, tax_rate (from site_settings), and due_date (+14d)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
  v_tax_rate       numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to generate invoices.';
  END IF;

  SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_invoice);
  END IF;

  SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Pull current tax rate from site_settings (string -> numeric)
  SELECT COALESCE(NULLIF(setting_value, '')::numeric, 0)
    INTO v_tax_rate
    FROM site_settings
   WHERE setting_key = 'tax_rate'
   LIMIT 1;
  IF v_tax_rate IS NULL THEN v_tax_rate := 0; END IF;

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email, address,
    line_items, services,
    subtotal, tax, tax_amount, tax_rate, total, total_amount,
    payment_status,
    issued_date, due_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    booking_record.address,
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.subtotal, booking_record.total_price, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    v_tax_rate,
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    'unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- ============================================================
-- 4. Identity resolution: get_admin_display_names(uuid[])
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_display_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Any authenticated staff can resolve admin display names.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
    SELECT u.id AS user_id,
           COALESCE(
             NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
             NULLIF(u.email, ''),
             'Admin user'
           )::text AS display_name
      FROM auth.users u
     WHERE u.id = ANY(_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_display_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_display_names(uuid[]) TO authenticated;

-- ============================================================
-- 5. Scheduling overlap: parse slot strings to a timerange
--    and detect overlaps for a given date.
-- ============================================================
CREATE OR REPLACE FUNCTION public.parse_time_slot(p_slot text)
RETURNS tsrange
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := trim(coalesce(p_slot, ''));
  parts text[];
  start_t time;
  end_t   time;
  base date := DATE '2000-01-01';
BEGIN
  IF s = '' THEN
    RETURN NULL;
  END IF;

  -- Range form: "7:00 AM - 11:00 AM"
  IF position(' - ' in s) > 0 OR position('-' in s) > 0 THEN
    parts := regexp_split_to_array(s, '\s*-\s*');
    IF array_length(parts, 1) = 2 THEN
      BEGIN
        start_t := parts[1]::time;
        end_t   := parts[2]::time;
      EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
      END;
      RETURN tsrange(base + start_t, base + end_t, '[)');
    END IF;
  END IF;

  -- Single time form: "23:00", "9:07", "7:00AM"
  BEGIN
    start_t := s::time;
    -- Treat single-time slots as 1-hour blocks for overlap purposes.
    RETURN tsrange(base + start_t, base + start_t + INTERVAL '1 hour', '[)');
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_slot_overlap(
  p_date date,
  p_time_slot text,
  p_exclude_booking uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
     AND b.status IN ('pending', 'confirmed')
     AND (p_exclude_booking IS NULL OR b.id <> p_exclude_booking)
     AND public.parse_time_slot(b.time_slot) IS NOT NULL
     AND public.parse_time_slot(b.time_slot) && proposed;

  RETURN conflict_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_slot_overlap(date, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parse_time_slot(text) TO anon, authenticated;
