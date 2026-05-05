
-- 1. Permission bundle registry entries
INSERT INTO public.permission_registry (key, label, description) VALUES
  ('bundle.operations', 'Operations Bundle', 'Bookings, Quotes, Messages, Availability'),
  ('bundle.finance', 'Finance Bundle', 'Invoices, Payments, Pricing'),
  ('bundle.content', 'Content Bundle', 'FAQs, Reviews, Gallery, Site Content, Service Areas'),
  ('bundle.system_admin', 'System Admin Bundle', 'Business Rules, Socials, plus Operations + Finance + Content')
ON CONFLICT (key) DO NOTHING;

-- 2. Allow Operations users to view invoices (read-only); writes still go through RPC.
DROP POLICY IF EXISTS "Operations can view linked invoices" ON public.invoices;
CREATE POLICY "Operations can view linked invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'can_manage_invoices')
    OR has_permission(auth.uid(),'can_manage_bookings')
    OR has_permission(auth.uid(),'can_manage_payment')
  );

-- 3. confirm_invoice_payment RPC (security definer, bypasses RLS).
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  v_new_paid numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Sign in required.';
  END IF;
  IF NOT (
    has_role(auth.uid(),'admin'::app_role)
    OR has_permission(auth.uid(),'can_manage_invoices')
    OR has_permission(auth.uid(),'can_manage_payment')
    OR has_permission(auth.uid(),'can_manage_bookings')
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Finance or Operations permission to record payments.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Amount must be greater than zero.';
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;

  v_new_paid := round(coalesce(inv.amount_paid, 0) + p_amount, 2);
  v_status := CASE
    WHEN v_new_paid >= coalesce(inv.total_amount, 0) AND coalesce(inv.total_amount,0) > 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END;

  UPDATE public.invoices SET
    amount_paid = v_new_paid,
    payment_method = p_method,
    payment_date = p_payment_date,
    payment_reference = NULLIF(p_reference, ''),
    payment_status = v_status,
    paid_at = CASE WHEN v_status = 'paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = p_invoice_id;

  IF v_status = 'paid' THEN
    PERFORM public.create_receipt(p_invoice_id);
  END IF;

  RETURN jsonb_build_object(
    'id', p_invoice_id,
    'payment_status', v_status,
    'amount_paid', v_new_paid
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, numeric, text, text, date) TO authenticated;

-- 4. Belt-and-suspenders: ensure Super Admin retains Finance keys explicitly.
UPDATE public.user_roles
SET permissions = COALESCE(permissions, '{}'::jsonb)
  || jsonb_build_object(
       'can_manage_invoices', true,
       'can_manage_payment', true,
       'can_edit_pricing', true
     )
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'joshuaquao@gmail.com');
