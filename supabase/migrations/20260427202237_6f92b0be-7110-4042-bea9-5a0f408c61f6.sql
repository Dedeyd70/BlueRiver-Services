
-- 5c.1 — convert_quote_to_booking: read snapshot from quote_drafts, hardcode pending + quote source, gate by permission
CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(p_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_booking bookings%ROWTYPE;
  quote_record     quote_requests%ROWTYPE;
  draft_record     quote_drafts%ROWTYPE;
  new_booking_id   uuid;
  v_line_items     jsonb := '[]'::jsonb;
  v_subtotal       numeric := 0;
  v_tax            numeric := 0;
  v_total          numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_quotes')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Quotes permission to convert this quote.';
  END IF;

  SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_booking);
  END IF;

  SELECT * INTO quote_record FROM quote_requests WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO draft_record FROM quote_drafts WHERE quote_id = p_quote_id;
  IF FOUND THEN
    v_line_items := COALESCE(draft_record.line_items, '[]'::jsonb);
    v_subtotal   := COALESCE((draft_record.breakdown->>'subtotal')::numeric, 0);
    v_tax        := COALESCE((draft_record.breakdown->>'tax_amount')::numeric, 0);
    v_total      := COALESCE((draft_record.breakdown->>'total')::numeric, 0);
  END IF;

  INSERT INTO bookings (
    id, quote_id, service_type_id,
    line_items, subtotal, tax_amount, total_amount, total_price,
    source, status, created_at
  )
  VALUES (
    gen_random_uuid(), quote_record.id, quote_record.service_type_id,
    v_line_items, v_subtotal, v_tax, v_total, v_total,
    'quote', 'pending', now()
  )
  RETURNING id INTO new_booking_id;

  RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_booking_id);
END;
$$;

-- 5c.2 — create_invoice_from_booking: SECURITY DEFINER + permission gate
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_invoice invoices%ROWTYPE;
  booking_record   bookings%ROWTYPE;
  new_invoice_id   uuid;
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

  INSERT INTO invoices (
    id, booking_id, quote_id,
    customer_name, customer_email,
    line_items, services,
    subtotal, tax, tax_amount, total, total_amount,
    payment_status,
    issued_date, created_at
  )
  VALUES (
    gen_random_uuid(),
    booking_record.id,
    booking_record.quote_id,
    COALESCE(booking_record.name, 'Customer'),
    COALESCE(booking_record.email, ''),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.line_items, '[]'::jsonb),
    COALESCE(booking_record.subtotal, booking_record.total_price, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    COALESCE(booking_record.total_amount, booking_record.total_price, 0),
    'unpaid',
    CURRENT_DATE,
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$$;

-- 5c.3 — mark_invoice_paid: SECURITY DEFINER + permission gate
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_invoice invoices%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_invoices')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Invoices permission to mark invoices as paid.';
  END IF;

  UPDATE invoices
     SET payment_status = 'paid',
         paid_at = now()
   WHERE id = p_invoice_id
  RETURNING * INTO updated_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  PERFORM public.create_receipt(updated_invoice.id);

  RETURN to_jsonb(updated_invoice);
END;
$$;

-- 5c.4 — Register Manage Invoices permission (idempotent)
INSERT INTO public.permission_registry (key, label, description)
SELECT 'can_manage_invoices', 'Manage Invoices', 'Generate, send, and mark invoices as paid'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permission_registry WHERE key = 'can_manage_invoices'
);
