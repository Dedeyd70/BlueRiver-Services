
CREATE OR REPLACE FUNCTION public.create_invoice_from_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    existing_invoice invoices%ROWTYPE;
    booking_record   bookings%ROWTYPE;
    new_invoice_id   uuid;
BEGIN
    -- Idempotent: reuse existing invoice for this booking
    SELECT * INTO existing_invoice FROM invoices WHERE booking_id = p_booking_id;
    IF FOUND THEN
        RETURN to_jsonb(existing_invoice);
    END IF;

    SELECT * INTO booking_record FROM bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- NOTE: invoice_number is intentionally OMITTED.
    -- The BEFORE INSERT trigger `set_invoice_number` populates it.
    INSERT INTO invoices (
        id, booking_id, quote_id,
        customer_name, customer_email,
        line_items, services,
        subtotal, tax, tax_amount, total, total_amount,
        payment_status, status,
        invoice_date, issued_date, created_at
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
        'draft',
        CURRENT_DATE,
        CURRENT_DATE,
        now()
    )
    RETURNING id INTO new_invoice_id;

    RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;
