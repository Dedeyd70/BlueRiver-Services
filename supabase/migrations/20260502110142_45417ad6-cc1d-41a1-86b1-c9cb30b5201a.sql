CREATE OR REPLACE FUNCTION public.parse_time_slot(p_slot text)
RETURNS tsrange
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text := trim(coalesce(p_slot, ''));
  parts text[];
  start_t time;
  end_t   time;
  base date := DATE '2000-01-01';
BEGIN
  IF s = '' THEN RETURN NULL; END IF;
  IF position(' - ' in s) > 0 OR position('-' in s) > 0 THEN
    parts := regexp_split_to_array(s, '\s*-\s*');
    IF array_length(parts, 1) = 2 THEN
      BEGIN
        start_t := parts[1]::time;
        end_t   := parts[2]::time;
      EXCEPTION WHEN OTHERS THEN RETURN NULL;
      END;
      RETURN tsrange(base + start_t, base + end_t, '[)');
    END IF;
  END IF;
  BEGIN
    start_t := s::time;
    RETURN tsrange(base + start_t, base + start_t + INTERVAL '1 hour', '[)');
  EXCEPTION WHEN OTHERS THEN RETURN NULL;
  END;
END;
$$;