-- ALTERATION GUARDS: Add original columns to FAQs table if they were missing
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
ALTER TABLE public.faqs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Public stats RPC (counts only, no PII)
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completed_bookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'unique_customers', (SELECT count(DISTINCT lower(trim(email))) FROM bookings WHERE status = 'completed' AND email IS NOT NULL AND email <> ''),
    'avg_rating', COALESCE((SELECT round(avg(rating)::numeric, 1) FROM reviews WHERE is_public = true), 0),
    'public_reviews', (SELECT count(*) FROM reviews WHERE is_public = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- FAQ admin management
DROP POLICY IF EXISTS "Admins manage FAQs" ON public.faqs;
CREATE POLICY "Admins manage FAQs"
ON public.faqs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'can_manage_settings'));

-- Seed FAQs only if empty
INSERT INTO public.faqs (question, answer, display_order, is_active)
SELECT * FROM (VALUES
  ('Do I need to be home during the cleaning?', 'No. Many of our clients provide entry instructions or a key/code. Our vetted team is fully insured, so you can carry on with your day with peace of mind.', 1, true),
  ('What is included in a deep clean?', 'A deep clean covers everything in a standard clean plus baseboards, interior windows, inside appliances (oven, fridge, microwave on request), detailed bathroom scrubbing, and removal of built-up grime in kitchens.', 2, true),
  ('Do you bring your own supplies and equipment?', 'Yes. We arrive fully equipped with professional-grade, eco-friendly cleaning products and equipment at no extra cost. We can also use your preferred products if you''d prefer.', 3, true),
  ('How do I pay for my cleaning?', 'We accept Cash and Zelle to info@blueriverservices.co. Payment is due upon completion of service unless invoiced separately for recurring or commercial accounts.', 4, true),
  ('What if I''m not satisfied with the cleaning?', 'Your satisfaction is guaranteed. If anything is missed, contact us within 24 hours and we''ll return to make it right at no additional charge.', 5, true)
) AS v(question, answer, display_order, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.faqs);
