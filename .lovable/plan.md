

# Make Nav + Route Guard Permission-Aware (revoke-respecting + live-sync)

## Root cause

Two structural gaps:

1. **Nav ignores permissions JSONB.** `src/lib/permissions.ts` filters strictly by role. Revoking `can_manage_gallery` from a manager has no effect because `roles: ["admin","manager"]` is hardcoded. Same bug for Bookings, Quotes, Messages, Submissions, Gallery, Testimonials, Settings.
2. **Permissions are fetched once.** `useAuth` reads `role` + `permissions` only when `user.id` changes. DB updates don't propagate until re-login.

## Fix — two layers, both additive

### 1. Permission key (when present) overrides role — `src/lib/permissions.ts`

Add optional `permission` field. Visibility precedence:

```ts
if (role === "admin") return true;
if (item.permission) return permissions[item.permission] === true;
return item.roles.includes(role);
```

Mapping:

| Nav item | `permission` |
|---|---|
| Bookings | `can_manage_bookings` |
| Quotes | `can_manage_quotes` |
| Messages | `can_manage_messages` |
| Submissions | `can_manage_messages` |
| Gallery | `can_manage_gallery` |
| Testimonials | `can_manage_testimonials` |
| Settings | `can_manage_settings` |
| Services / Branding / Homepage / Legal / Privacy / Terms / Users / Permissions | unchanged (admin-only) |
| Dashboard / Account | unchanged |

Update signatures:
```ts
type PermissionsMap = Record<string, boolean>;
getFilteredNavItems(role, permissions)
getGroupedNavItems(role, permissions)
canAccessPath(role, path, permissions)
```

### 2. Live permission sync — `src/hooks/useAuth.tsx` (surgical merge)

**Preserve** the existing session-bootstrap `useEffect` (listener-first, then `getSession`), idle-timeout effect, `signIn`, `doSignOut`, and context shape. **Touch only** the role-resolution effect.

Refactor steps:

a. Extract the inline role/permissions read into a stable `refetchRole(userId)` callback wrapped in `useCallback`. It performs the existing `from("user_roles").select("role, permissions").eq("user_id", userId).maybeSingle()` and updates `role` / `isAdmin` / `permissions` exactly as today.

b. Existing role-resolution `useEffect` keeps its `user?.id` dependency but now just calls `refetchRole(user.id)` and manages the `cancelled` + `roleLoading` flags.

c. **Add** a second `useEffect` keyed on `user?.id` that:
- Subscribes to `postgres_changes` UPDATE on `user_roles` filtered by `user_id=eq.${user.id}`. Channel name `user-role-${user.id}`. On payload, applies the same `role` / `isAdmin` / `permissions` update inline (no extra round-trip needed — payload `new` carries both columns thanks to `REPLICA IDENTITY FULL`).
- Adds `visibilitychange` + window `focus` listeners that call `refetchRole(user.id)` as a fallback when realtime drops.
- Cleanup: `supabase.removeChannel(ch)`, remove both listeners.

d. No changes to context value, no new exposed fields.

### 3. Caller — `src/pages/admin/AdminLayout.tsx`

Pull `permissions` from `useAuth()`, pass into `getGroupedNavItems(role, permissions)` and `canAccessPath(role, location.pathname, permissions)`. Sidebar re-renders automatically when `permissions` state updates.

### 4. Migration (additive)

```sql
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
```

Required so the realtime subscription receives UPDATE events with full row payloads.

## Files Touched

| File | Change |
|---|---|
| `src/lib/permissions.ts` | Add optional `permission` field; rewrite 3 helpers with admin → key → role precedence |
| `src/hooks/useAuth.tsx` | Extract `refetchRole` callback; add realtime subscription + focus/visibility refetch (existing session/idle/signIn logic untouched) |
| `src/pages/admin/AdminLayout.tsx` | Pass `permissions` into nav helpers and route guard |
| New migration | Add `user_roles` to `supabase_realtime`; set `REPLICA IDENTITY FULL` |

## Untouched

Session bootstrap, idle timeout, `signIn`, `signOut`, `usePermissions`, `<HasPermission>`, existing RLS, registry, edge functions, settings pages, dashboard.

