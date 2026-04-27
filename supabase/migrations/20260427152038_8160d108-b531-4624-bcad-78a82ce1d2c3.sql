-- 1. Fix create_invoice_from_booking — remove reference to nonexistent `status` column
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    existing_invoice invoices%ROWTYPE;
    booking_record   bookings%ROWTYPE;
    new_invoice_id   uuid;
BEGIN
    SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_invoice);
    END IF;

    SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- invoice_number is populated by the BEFORE INSERT trigger `set_invoice_number`.
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
$function$;

-- 2. Fix mark_invoice_paid — drop the nonexistent `status` column from UPDATE
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    updated_invoice invoices%ROWTYPE;
BEGIN
    UPDATE invoices
    SET
        payment_status = 'paid',
        paid_at = now()
    WHERE id = p_invoice_id
    RETURNING * INTO updated_invoice;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found';
    END IF;

    PERFORM create_receipt(updated_invoice.id);

    RETURN to_jsonb(updated_invoice);
END;
$function$;

-- 3. Fix convert_quote_to_booking — tag source='quote' on creation
CREATE OR REPLACE FUNCTION public.convert_quote_to_booking(p_quote_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    existing_booking bookings%ROWTYPE;
    quote_record quote_requests%ROWTYPE;
    new_booking_id uuid;
BEGIN
    SELECT * INTO existing_booking FROM bookings WHERE quote_id = p_quote_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_booking);
    END IF;

    SELECT * INTO quote_record FROM quote_requests WHERE id = p_quote_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quote not found';
    END IF;

    INSERT INTO bookings (
        id,
        quote_id,
        service_type_id,
        line_items,
        total_price,
        source,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        quote_record.id,
        quote_record.service_type_id,
        quote_record.line_items,
        quote_record.total,
        'quote',
        now()
    )
    RETURNING id INTO new_booking_id;

    RETURN (SELECT to_jsonb(b) FROM bookings b WHERE id = new_booking_id);
END;
$function$;

-- 4. Backfill: bookings with no quote link should be classified as 'manual'.
UPDATE public.bookings
SET source = 'manual'
WHERE quote_id IS NULL
  AND (source IS NULL OR source = 'quote');