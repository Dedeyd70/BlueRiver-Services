# Fix: Become a Cleaner submission returns 401

## Root cause
In `src/pages/BecomeACleaner.tsx` the public submit does:

```ts
supabase.from("cleaner_applications").insert([...]).select("id").maybeSingle()
```

The `.select("id")` makes PostgREST try to `RETURNING` the new row to the caller. That read is governed by RLS, and `cleaner_applications` only has a `SELECT` policy for admins / users with `can_manage_applications`. For an anonymous visitor there is no matching SELECT policy, so PostgREST rejects the response with a permission error that supabase-js surfaces as **401 Unauthorized**. The `if (error)` branch then fires and the user sees "Could not submit application."

The INSERT itself is allowed (policy `"Anyone can submit cleaner applications"` with `WITH CHECK (true)` for `anon, authenticated`), and table grants are correct (`anon` has INSERT). The failure is purely the post-insert read.

## Fix (frontend only, minimal)

Edit `src/pages/BecomeACleaner.tsx` submit handler:

1. Drop `.select("id").maybeSingle()` from the insert call so PostgREST does not try to return the row to the anon caller.
2. Change the destructure to `const { error } = await supabase.from("cleaner_applications").insert([...])`.
3. Update the `notifyAdmins(...)` call to pass `undefined` for the reference id (we no longer have the new row's id client-side). The notification message and routing still work; admins land on the Cleaner Applications inbox where the new row appears via realtime.

No schema, RLS, grants, or admin-side changes are needed. Existing admin SELECT/UPDATE/DELETE policies and the realtime subscription on `cleaner_applications` keep working.

## Verification
- Submit the public form while logged out → toast shows "Application submitted!", success state renders, row appears in `Admin → Cleaner Applications`.
- Admin notification bell shows the new "cleaner_application" entry and links to the inbox.
- Existing admin actions (status change, delete) still work.

## Out of scope
- No changes to RLS policies, grants, table schema, or migrations.
- No changes to the admin page, notification routing, navbar, or styling.
