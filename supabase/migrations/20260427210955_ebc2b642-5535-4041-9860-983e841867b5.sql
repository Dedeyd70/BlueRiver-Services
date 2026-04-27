DROP FUNCTION IF EXISTS public.convert_quote_to_booking(uuid);
DROP FUNCTION IF EXISTS public.convert_quote_to_booking(uuid, date, text);

CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(
  p_quote_id     uuid,
  p_booking_date date,
  p_time_slot    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_booking bookings%ROWTYPE;
  q  quote_requests%ROWTYPE;
  d  quote_drafts%ROWTYPE;
  new_id uuid;
  v_line_items jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_permission(auth.uid(), 'can_manage_quotes')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Manage Quotes permission to convert this quote.';
  END IF;

  SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
  IF FOUND THEN
    RETURN to_jsonb(existing_booking);
  END IF;

  SELECT * INTO q FROM quote_requests WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO d FROM quote_drafts WHERE quote_id = p_quote_id;
  IF FOUND THEN
    v_line_items := COALESCE(d.line_items, '[]'::jsonb);
    v_subtotal   := COALESCE((d.breakdown->>'subtotal')::numeric, 0);
    v_tax        := COALESCE((d.breakdown->>'tax_amount')::numeric, 0);
    v_total      := COALESCE((d.breakdown->>'total')::numeric, 0);
  END IF;

  INSERT INTO bookings (
    id, quote_id, service_type_id, service_type,
    name, email, phone, address,
    booking_date, time_slot,
    notes, consent_given,
    property_type, square_footage, bedrooms, bathrooms,
    frequency, floor_type, condition_level,
    is_empty_property, has_pets, pet_count, entry_codes,
    selected_addons, custom_fields,
    line_items, subtotal, tax_amount, total_amount, total_price,
    source, status, created_at
  ) VALUES (
    gen_random_uuid(), q.id, q.service_type_id, q.service_type,
    COALESCE(NULLIF(q.name, ''), 'Customer'),
    COALESCE(NULLIF(q.email, ''), ''),
    q.phone,
    COALESCE(NULLIF(q.address, ''), 'Address on file'),
    p_booking_date, p_time_slot,
    q.description, COALESCE(q.consent_given, false),
    q.property_type, q.square_footage, q.bedrooms, q.bathrooms,
    q.frequency, q.floor_type, q.condition_level,
    COALESCE(q.is_empty_property, false), COALESCE(q.has_pets, false), q.pet_count, q.entry_codes,
    COALESCE(q.selected_addons, '[]'::jsonb), COALESCE(q.custom_fields, '{}'::jsonb),
    v_line_items, v_subtotal, v_tax, v_total, v_total,
    'quote', 'pending', now()
  )
  RETURNING id INTO new_id;

  UPDATE quote_requests SET status = 'converted', updated_at = now() WHERE id = p_quote_id;

  RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_id);
END;
$$;