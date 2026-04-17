-- 1. service_types
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read service types" ON public.service_types FOR SELECT USING (true);
CREATE POLICY "Admins manage service types" ON public.service_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_service_types_updated BEFORE UPDATE ON public.service_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. service_pricing_rules
CREATE TABLE public.service_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  unit_price INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_type_id, category)
);
ALTER TABLE public.service_pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pricing rules" ON public.service_pricing_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage pricing rules" ON public.service_pricing_rules FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_pricing_rules_updated BEFORE UPDATE ON public.service_pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. condition_settings
CREATE TABLE public.condition_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  surcharge_amount INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.condition_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read conditions" ON public.condition_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage conditions" ON public.condition_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_condition_settings_updated BEFORE UPDATE ON public.condition_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.condition_settings (name, surcharge_amount) VALUES
  ('Light', 0), ('Standard', 20), ('Heavy', 50), ('Post-Renovation', 100);

-- Seed service_types from existing main services
INSERT INTO public.service_types (name, base_price)
SELECT title, COALESCE(NULLIF(regexp_replace(COALESCE(price_starting,'0'), '[^0-9]', '', 'g'), '')::int, 0)
FROM public.services
WHERE service_category = 'main' AND is_active = true
ON CONFLICT (name) DO NOTHING;

-- Seed default pricing rules per service
INSERT INTO public.service_pricing_rules (service_type_id, category, unit_price)
SELECT st.id, cat, 0
FROM public.service_types st
CROSS JOIN (VALUES ('Bedroom'),('Bathroom'),('FullBath'),('HalfBath'),('Kitchen'),('LivingRoom'),('OfficeRoom')) AS c(cat)
ON CONFLICT (service_type_id, category) DO NOTHING;

-- 4. quote_drafts.line_items
ALTER TABLE public.quote_drafts ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5. Update invoice number prefix to BR-
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'BR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;