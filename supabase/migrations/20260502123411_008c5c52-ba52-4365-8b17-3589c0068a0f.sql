-- Phase 1: Update invoice due date to 7 days; add booking date guard

CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    CURRENT_DATE + INTERVAL '7 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- Server-side No-Backdating guard for bookings.
-- Triggered on INSERT and on UPDATE of booking_date.
-- Allows historical rows to remain (only checks NEW value when it changes).
CREATE OR REPLACE FUNCTION public.enforce_booking_date_not_past()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.booking_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'BACKDATING_NOT_ALLOWED: Bookings cannot be scheduled in the past.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.booking_date IS DISTINCT FROM OLD.booking_date
       AND NEW.booking_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'BACKDATING_NOT_ALLOWED: Bookings cannot be rescheduled to a past date.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_date_not_past ON public.bookings;
CREATE TRIGGER trg_enforce_booking_date_not_past
BEFORE INSERT OR UPDATE OF booking_date ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_booking_date_not_past();