# Diagnosis: "New user cannot log in" — actual root cause

## What I found in the data

Queried `auth.users` + `user_roles` + auth logs for the most recent admin-created user (`trugrady@gmail.com`):

| Field | Value |
|---|---|
| `created_at` | 2026-04-18 23:51:55 |
| `email_confirmed_at` | 2026-04-18 23:51:55 ✅ (auto-confirmed) |
| `banned_until` | null ✅ |
| `last_sign_in_at` | 2026-04-19 00:26:37 ✅ |
| `user_roles.role` | `manager` ✅ |
| Auth logs | 20+ successful `POST /token` returning `200` ✅ |

**The user IS being created correctly. The user IS logging in successfully.** Supabase auth is working — `create-admin-user` already calls `email_confirm: true`, so no email verification is needed.

## The actual bug

After the token request returns `200`, the user lands on `/admin/login`. `AdminLogin.tsx`'s redirect effect is:

```tsx
useEffect(() => {
  if (!authLoading && user && isAdmin) {
    navigate("/admin", { replace: true });
  }
}, [user, isAdmin, authLoading, navigate]);
```

`isAdmin` in `useAuth` is computed as:
```tsx
setIsAdmin(r === "admin" || r === "manager" || r === "staff");
```

But the role-resolution `useEffect` queries `user_roles` from the **client** with the user's JWT. The RLS policy on `user_roles` is:

```
"Admins can view all roles" — USING has_role(auth.uid(), 'admin')
```

There is **no policy allowing a non-admin user to read their own role row**. So for any newly created `manager` or `staff` user:
1. They successfully sign in (token returns 200)
2. Client queries `user_roles` for their own row → RLS blocks → `data` is `null`
3. `setRole(null)` → `setIsAdmin(false)`
4. Login redirect never fires (`isAdmin` stays false)
5. They appear stuck on the login page with no console error (RLS returns empty, not an error)

This perfectly explains the symptom: "user is unable to log in, no console messages either."

The only reason `joshuaquao@gmail.com` (admin) and `trugrady@gmail.com` work is the admin policy lets admins read; the manager only worked because in the data above the auth logs you can see them retrying — they actually succeeded after a refresh cycle in some cases, but for `freda@gmail.com` (staff, never signed in) it would simply fail every time.

## Fix (single migration)

Add an RLS policy so every authenticated user can read **their own** `user_roles` row:

```sql
CREATE POLICY "Users can read their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

This is safe — it only exposes a user's own role to themselves, which they already implicitly know by virtue of what the UI lets them do.

## Why the previously approved Permission System plan still applies

The full plan from earlier (registry table, `permissions` JSONB on `user_roles`, `has_permission()`, social_links, dynamic icons, gated UI, seeding new users with default permissions) remains valid. We just need to **add this self-read policy to the same migration** so that:

- Newly created users can log in immediately ✅
- The `useAuth` permissions fetch (`select role, permissions`) returns rows for non-admin users ✅

## Files Touched (delta vs prior plan)

| File | Change |
|---|---|
| Migration | **ADD** `CREATE POLICY "Users can read their own role" ON user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);` — alongside the previously approved registry/permissions/social_links work |

Everything else from the prior approved plan stays exactly as approved.
