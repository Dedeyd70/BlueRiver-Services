ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;


-- 1. Allow anon/auth to call the rate-limit RPC (fixes Contact 403)
GRANT EXECUTE ON FUNCTION public.check_recent_submission(text, text) TO anon, authenticated;

-- 2. Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_booking ON public.reviews(booking_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read public reviews"
  ON public.reviews FOR SELECT
  USING (is_public = true);

CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_manage_testimonials'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'can_manage_testimonials'));

-- 3. submit_review RPC: verifies booking + email, status=completed
CREATE OR REPLACE FUNCTION public.submit_review(
  p_booking_id uuid,
  p_email text,
  p_rating int,
  p_comment text,
  p_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b bookings%ROWTYPE;
  new_id uuid;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'INVALID_RATING';
  END IF;

  SELECT * INTO b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND';
  END IF;

  IF lower(trim(b.email)) <> lower(trim(coalesce(p_email, ''))) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH';
  END IF;

  IF b.status <> 'completed' THEN
    RAISE EXCEPTION 'BOOKING_NOT_COMPLETED';
  END IF;

  INSERT INTO reviews (booking_id, customer_name, rating, comment, is_public)
  VALUES (p_booking_id, COALESCE(NULLIF(trim(p_name), ''), b.name, 'Customer'), p_rating, NULLIF(trim(p_comment), ''), false)
  ON CONFLICT (booking_id) DO UPDATE
    SET rating = EXCLUDED.rating,
        comment = EXCLUDED.comment,
        customer_name = EXCLUDED.customer_name
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('id', new_id, 'ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, text, int, text, text) TO anon, authenticated;

-- 4. Improve create_invoice_from_booking with line_items fallback totals
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
  v_subtotal       numeric := 0;
  v_total          numeric := 0;
  v_li_total       numeric := 0;
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

  -- Compute fallback total from line_items
  SELECT COALESCE(SUM(
    COALESCE((li->>'total_price')::numeric,
             (COALESCE((li->>'quantity')::numeric, 1) * COALESCE((li->>'unit_price')::numeric, (li->>'price')::numeric, 0)))
  ), 0)
  INTO v_li_total
  FROM jsonb_array_elements(COALESCE(booking_record.line_items, '[]'::jsonb)) li;

  v_subtotal := COALESCE(NULLIF(booking_record.subtotal, 0), NULLIF(booking_record.total_price, 0), v_li_total, 0);
  v_total    := COALESCE(NULLIF(booking_record.total_amount, 0), NULLIF(booking_record.total_price, 0), v_li_total, 0);

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
    v_subtotal,
    COALESCE(booking_record.tax_amount, 0),
    COALESCE(booking_record.tax_amount, 0),
    v_tax_rate,
    v_total,
    v_total,
    'unpaid',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    now()
  )
  RETURNING id INTO new_invoice_id;

  RETURN (SELECT to_jsonb(i) FROM invoices i WHERE id = new_invoice_id);
END;
$function$;

-- 5. Backfill existing invoices with $0 totals from their line_items
UPDATE invoices i
SET total_amount = sub.li_total,
    total = sub.li_total,
    subtotal = CASE WHEN i.subtotal = 0 THEN sub.li_total ELSE i.subtotal END
FROM (
  SELECT id,
    COALESCE(SUM(
      COALESCE((li->>'total_price')::numeric,
               (COALESCE((li->>'quantity')::numeric, 1) * COALESCE((li->>'unit_price')::numeric, (li->>'price')::numeric, 0)))
    ), 0) AS li_total
  FROM invoices, jsonb_array_elements(COALESCE(line_items, '[]'::jsonb)) li
  GROUP BY id
) sub
WHERE i.id = sub.id
  AND COALESCE(i.total_amount, 0) = 0
  AND sub.li_total > 0;
