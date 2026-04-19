

# Make Dashboard + Settings Tabs Truly Permission-Aware

## Root cause

**A. Dashboard hidden from Staff with bookings permission.**
In `src/lib/permissions.ts` line 28 the Dashboard row has **no `permission` key**, so `isVisible()` falls through to the role check. Staff is not in `["admin","manager"]` → hidden in nav AND `canAccessPath("/admin", …)` returns false → `AdminLayout` redirects to `/admin` (the very page they can't access) → loop / blank.

**B. Manager sees every Settings tab.**
`src/pages/admin/SettingsAdmin.tsx` only wraps the **Socials** tab in a permission check. General / Availability / Payment / Pricing render unconditionally for any authenticated admin-role user, including Manager.

## Fix

### 1. `src/lib/permissions.ts` — Dashboard accessible by permission, not just role

Add a helper "user has any management permission" so Dashboard becomes visible the moment a non-admin user is granted any operational permission. Cleaner than inventing `can_view_dashboard` (no DB / registry change needed).

```ts
const hasAnyManagementPermission = (permissions: PermissionsMap) =>
  Object.values(permissions || {}).some((v) => v === true);
```

Update the Dashboard row to use a sentinel key:
```ts
{ label: "Dashboard", path: "/admin", roles: ["admin","manager"], group: "main", permission: "__dashboard__" },
```

In `isVisible`, intercept the sentinel:
```ts
if (role === "admin") return true;
if (item.permission === "__dashboard__") {
  return item.roles.includes(role) || hasAnyManagementPermission(permissions);
}
if (item.permission) return permissions?.[item.permission] === true;
return item.roles.includes(role);
```

Result: Manager keeps Dashboard, Staff with any granular permission gains Dashboard, Staff with zero permissions still does not see it.

### 2. Add `Account` access fallback for non-admins who lose nav access

Ensure `canAccessPath("/admin/account", …)` always returns true for authenticated non-admins so they aren't trapped. Account row already lists all roles, so this works as-is — verify and leave untouched.

### 3. `src/pages/admin/SettingsAdmin.tsx` — gate each tab individually

Replace the static tab list with conditional triggers + content, each gated by its own permission key (admin bypasses via existing `useHasPermission` logic which already returns true for admin):

| Tab | Permission key |
|---|---|
| General | `can_manage_settings` |
| Availability | `can_manage_settings` |
| Payment | `can_manage_settings` |
| Pricing | `can_edit_pricing` |
| Social Media | `can_manage_socials` |

Behavior:
- Compute `canGeneral`, `canPricing`, `canSocials` etc. via `useHasPermission`.
- Only render `<TabsTrigger>` + `<TabsContent>` pairs for the granted tabs.
- Compute `defaultValue` as the first granted tab so the page never opens to a hidden tab. If none granted (shouldn't happen — route is gated upstream), show "No settings available".

Manager (no toggles) → sees nothing extra; with `can_manage_socials` only → sees Social Media only. Admin → sees all tabs.

### 4. No DB changes, no registry changes

`__dashboard__` is a code-side sentinel only; never written to the registry or `user_roles.permissions`. `can_edit_pricing` already exists in the registry. All other keys already exist.

## Files Touched

| File | Change |
|---|---|
| `src/lib/permissions.ts` | Add `hasAnyManagementPermission` helper; sentinel `__dashboard__` permission on Dashboard row; intercept in `isVisible` |
| `src/pages/admin/SettingsAdmin.tsx` | Per-tab `useHasPermission` checks; dynamic `defaultValue`; hide ungranted tabs entirely |

## Untouched

`useAuth`, `usePermissions`, `<HasPermission>`, RLS policies, registry inserts, `AdminLayout`, edge functions, all other admin pages.

