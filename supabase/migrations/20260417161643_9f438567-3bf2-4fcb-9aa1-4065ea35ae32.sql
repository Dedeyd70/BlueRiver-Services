-- Add quote_id link to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL;

-- Add close_reason to quote_requests
ALTER TABLE public.quote_requests ADD COLUMN IF NOT EXISTS close_reason text;

-- Invoice number sequence + columns
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0;

-- Function + trigger to auto-generate invoice numbers like INV-YYYY-0001
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_number ON public.invoices;
CREATE TRIGGER set_invoice_number
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();