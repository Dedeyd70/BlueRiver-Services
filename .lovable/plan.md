

# Dynamic Permission System + Social Links + Login Fix

Single atomic migration + UI work. Includes the `user_roles` self-read RLS fix so newly created managers/staff can actually log in.

## Migration (one transaction, runs before any UI ships)

```sql
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
```

## New files

- `src/lib/socialIcons.ts` — `normalizePlatform()` (trim + lowercase + strip spaces) + `getSocialIcon()` (Lucide map, falls back to `Link`). Handles `"Facebook "`, `"FACEBOOK"`, `"face book"` → Facebook icon.
- `src/hooks/usePermissions.tsx` — `useHasPermission(key)` (admin always true) + `usePermissionRegistry()`
- `src/components/HasPermission.tsx` — `<HasPermission permission="..." fallback={...}>`
- `src/hooks/useSocialLinks.ts` — public query for active links, ordered
- `src/pages/admin/PermissionsAdmin.tsx` — registry CRUD (admin-only)
- `src/components/admin/SocialLinksSettings.tsx` — list + add/edit/delete with **live icon preview** as admin types `platform_name` ("Matched: Facebook" / "No match — using Link icon")

## Edited files

- `supabase/functions/create-admin-user/index.ts` — after role insert, seed `permissions` with all registry keys defaulting to `false`
- `src/hooks/useAuth.tsx` — select `role, permissions` together; expose `permissions` in context; re-fetch on `SIGNED_IN` / `TOKEN_REFRESHED`
- `src/lib/permissions.ts` — add `Permissions` nav entry (admin-only, "system" group)
- `src/App.tsx` — register `/admin/permissions` route
- `src/pages/admin/AdminLayout.tsx` — add `Permissions` icon to `iconMap`
- `src/pages/admin/UserManagement.tsx` — per-user "Permissions" dialog: `<Switch>` per registry key; admin role shows all-on disabled
- `src/pages/admin/SettingsAdmin.tsx` — add "Social Media" tab wrapped in `<HasPermission permission="can_manage_socials">`
- `src/components/Footer.tsx` — render dynamic social icons via `useSocialLinks()` + `getSocialIcon()`; hidden when no active links

## Permission semantics

```ts
useHasPermission("can_manage_socials")
// admin → true
// user_roles.permissions["can_manage_socials"] === true → true
// otherwise → false
```

Database `has_permission()` mirrors this exactly — UI gating and RLS share one truth.

## What's untouched

- Role system (`admin`/`manager`/`staff`) — permissions are additive
- Existing `NAV_PERMISSIONS`, edge functions for user CRUD, `service_type_id` work
- Public footer layout (only the icon row data source changes)

## Files Touched

| File | Change |
|---|---|
| New migration | registry + `user_roles.permissions` + `social_links` + `has_permission()` + RLS + **self-read user_roles policy** + seed (atomic) |
| `supabase/functions/create-admin-user/index.ts` | Seed default permissions on user creation |
| `src/lib/socialIcons.ts` | New: normalizer + icon map + `Link` fallback |
| `src/hooks/usePermissions.tsx` | New |
| `src/components/HasPermission.tsx` | New |
| `src/hooks/useSocialLinks.ts` | New |
| `src/pages/admin/PermissionsAdmin.tsx` | New: registry CRUD |
| `src/components/admin/SocialLinksSettings.tsx` | New: gated CRUD + live icon preview |
| `src/hooks/useAuth.tsx` | Expose permissions JSONB; re-fetch on auth events |
| `src/lib/permissions.ts` | Add Permissions nav entry |
| `src/App.tsx` | Register `/admin/permissions` |
| `src/pages/admin/AdminLayout.tsx` | Add Permissions icon |
| `src/pages/admin/UserManagement.tsx` | Per-user permissions dialog |
| `src/pages/admin/SettingsAdmin.tsx` | Add gated Social Media tab |
| `src/components/Footer.tsx` | Render dynamic social icons |

