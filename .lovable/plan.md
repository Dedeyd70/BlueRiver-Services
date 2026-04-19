

# Fix `delete-admin-user` 400 Bad Request

## Root cause analysis

Function logs show only Boot/Shutdown — no exception traces, meaning the 400s are the function's own thrown errors (caught and returned with `status: 400`), not crashes. Three concrete bugs make most legitimate calls fail before `auth.admin.deleteUser` is ever reached:

1. **Wrong env var name for anon key.** Line 19 reads `SUPABASE_PUBLISHABLE_KEY`. That secret exists, but `createClient` for caller validation requires the project's anon key (`SUPABASE_ANON_KEY` — also present in secrets). With the publishable key the caller client rejects the JWT → `caller` is null → `"Unauthorized"` 400. This is the primary failure mode for every delete attempt.
2. **Foreign-key cascade gap.** The function deletes the `user_roles` row then calls `auth.admin.deleteUser`. Other tables (`bookings.assigned_to`, `invoices.created_by`, `gallery.uploaded_by`, etc.) likely reference `auth.users(id)` without `ON DELETE CASCADE/SET NULL`, so the auth delete throws `"User is still referenced from table ..."` → caught → 400 with that message. Need to verify and either null those FKs first or rely on cascades.
3. **Opaque error surface.** All errors return generic 400. Should distinguish 401 (no auth / bad caller), 403 (not admin), 404 (target not found), 409 (last admin / referenced), 400 (validation) so the UI shows the real cause and the network tab is diagnosable.

Bonus: client sends `{ user_id }` (matches), but accept `targetUserId` too for robustness.

## Plan

### 1. `supabase/functions/delete-admin-user/index.ts` — rewrite

- Use `SUPABASE_ANON_KEY` (correct var) for `callerClient`.
- Parse body once, accept `user_id` **or** `targetUserId`.
- Explicit guard chain with proper status codes:
  - Missing auth header → **401** `"Missing authorization header"`
  - `getUser()` fails / null → **401** `"Invalid or expired session"`
  - Caller role lookup fails → **403** `"Caller has no role assigned"`
  - Caller role !== `"admin"` → **403** `"Only Super Admin can delete users"`
  - Missing `user_id` → **400** `"user_id is required"`
  - Self-delete → **400** `"Cannot delete your own account"`
  - Last admin guard: count `role='admin'` rows; if target is admin and count ≤ 1 → **409** `"Cannot delete the last Super Admin"`
  - Target lookup via `adminClient.auth.admin.getUserById(user_id)`; if not found → **404** `"User not found"`
- Pre-deletion FK cleanup with `adminClient` (SET NULL on tracking columns owned by deleted user):
  - `bookings.assigned_to = NULL where assigned_to = user_id`
  - `invoices.created_by = NULL where created_by = user_id` (if column exists)
  - any other admin-owned audit columns surfaced by the schema check below
- Delete `user_roles` row (idempotent — no error if missing).
- Call `adminClient.auth.admin.deleteUser(user_id)`. On error, surface the actual Postgres/auth message: **409** `"Cannot delete: ${error.message}"` so FK violations are visible.
- Success → **200** `{ success: true, deleted_user_id }`.
- Wrap everything in try/catch returning **500** with the real message for unexpected throws (so we don't mask bugs as 400s).

### 2. Schema audit (read-only, before writing the function)

Run a quick `read_query` against `information_schema.key_column_usage` to enumerate all FKs pointing at `auth.users` so the cleanup step covers every owning column. If any FK is `NO ACTION` and not nullable (rare for audit cols), include a follow-up migration to set it nullable + `ON DELETE SET NULL`.

### 3. Client tweak — `src/pages/admin/UserManagement.tsx`

`removeUser.mutationFn` currently surfaces `res.error.message` then `res.data?.error`. When edge function returns non-2xx, `supabase-js` puts the parsed body on `res.error.context` for FunctionsHttpError. Update the error extraction to:
- Try `res.data?.error` first (works for 4xx where body is parsed),
- Fall back to `res.error?.message`,
- Default to `"Failed to delete user"`.

This ensures the toast shows the specific reason ("Cannot delete the last Super Admin", "User is still referenced from table bookings", etc.) instead of a generic 400.

### 4. No migration unless schema audit reveals a non-nullable FK

If audit shows clean SET NULL / nullable columns, no DB change needed. If not, single additive migration: `ALTER TABLE ... ALTER COLUMN ... DROP NOT NULL` + `DROP CONSTRAINT ... ADD CONSTRAINT ... ON DELETE SET NULL`.

## Files Touched

| File | Change |
|---|---|
| `supabase/functions/delete-admin-user/index.ts` | Fix anon-key var, status-code-correct guard chain, FK cleanup, accept `user_id`/`targetUserId`, surface real errors |
| `src/pages/admin/UserManagement.tsx` | Improve error extraction in `removeUser.mutationFn` so toast shows specific reason |
| (conditional) New migration | Only if schema audit finds blocking FKs |

## Untouched

`create-admin-user`, `list-admin-users`, `useAuth`, RLS, permissions registry, nav helpers.

