CREATE TABLE public.quote_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL UNIQUE REFERENCES public.quote_requests(id) ON DELETE CASCADE,
  service_type text,
  scope text,
  base_price numeric NOT NULL DEFAULT 0,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  notes text,
  validity_days integer NOT NULL DEFAULT 7,
  prepared_by uuid,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quote drafts"
  ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage quote drafts"
  ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff can manage quote drafts"
  ON public.quote_drafts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE TRIGGER update_quote_drafts_updated_at
  BEFORE UPDATE ON public.quote_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_quote_drafts_quote_id ON public.quote_drafts(quote_id);