-- 1. Permission registry
CREATE TABLE public.permission_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Per-user grants on existing user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Dynamic social links
CREATE TABLE public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL,
  url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_social_links_updated_at
BEFORE UPDATE ON public.social_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. SECURITY DEFINER permission check
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR (permissions ->> _key)::boolean = true)
  )
$$;

-- 5. RLS — registry
ALTER TABLE public.permission_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read registry" ON public.permission_registry
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage registry" ON public.permission_registry
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 6. RLS — social_links
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active socials" ON public.social_links
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins read all socials" ON public.social_links
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Permitted users manage socials" ON public.social_links
  FOR ALL TO authenticated
  USING (has_permission(auth.uid(),'can_manage_socials'))
  WITH CHECK (has_permission(auth.uid(),'can_manage_socials'));

-- 7. LOGIN FIX — let users read their own role row
CREATE POLICY "Users can read their own role"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- 8. Seed registry
INSERT INTO public.permission_registry (key,label,description) VALUES
  ('can_manage_socials','Manage Social Links','Add/edit/delete social media links'),
  ('can_edit_pricing','Edit Pricing','Change service prices and rules'),
  ('can_publish_gallery','Publish Gallery','Add/remove gallery items'),
  ('can_manage_legal','Manage Legal Pages','Edit legal/policy content')
ON CONFLICT (key) DO NOTHING;