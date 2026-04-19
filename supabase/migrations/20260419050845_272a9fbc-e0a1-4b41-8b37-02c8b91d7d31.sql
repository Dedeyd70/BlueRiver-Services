INSERT INTO public.permission_registry (key, label, description) VALUES
  ('can_manage_business_rules', 'Manage Business Rules', 'Edit booking auto-approval and tax rate'),
  ('can_manage_site_content', 'Manage Site Content', 'Edit homepage, about, footer copy and stats')
ON CONFLICT (key) DO NOTHING;