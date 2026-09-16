CREATE TABLE public.google_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_key text NOT NULL UNIQUE,
  author_name text NOT NULL,
  author_photo_url text,
  author_uri text,
  rating integer NOT NULL,
  text text,
  relative_time text,
  publish_time timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.google_reviews TO anon;
GRANT SELECT ON public.google_reviews TO authenticated;
GRANT ALL ON public.google_reviews TO service_role;

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read google reviews"
  ON public.google_reviews FOR SELECT
  USING (true);

CREATE TRIGGER update_google_reviews_updated_at
  BEFORE UPDATE ON public.google_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_google_reviews_publish_time ON public.google_reviews (publish_time DESC);