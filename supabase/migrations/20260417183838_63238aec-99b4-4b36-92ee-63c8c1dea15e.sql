ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS kitchen_count integer,
  ADD COLUMN IF NOT EXISTS condition_level text;

ALTER TABLE public.quote_drafts
  ADD COLUMN IF NOT EXISTS condition_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS manual_adjustment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;