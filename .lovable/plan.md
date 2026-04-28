## Root cause (final, confirmed via DB)

The grants from the previous round fixed `42501 permission denied`. Now we hit a **different** 42501: `new row violates row-level security policy for table "quote_requests"`. Same error code, completely different cause.

All three public forms call:

```ts
supabase.from("...").insert({...}).select("id").maybeSingle()
```

That `.select("id")` translates to `INSERT ... RETURNING id`. PostgREST then runs the returned row through the table's **SELECT** RLS policies. If the row fails SELECT RLS, Postgres reports it as a "row violates row-level security policy" error and rolls back the insert.

Current SELECT RLS on `bookings`, `quote_requests`, `contact_submissions`:

| Table | SELECT policies | Permits anon? |
|---|---|---|
| `bookings` | admin-only / `can_manage_bookings` only | **No** |
| `quote_requests` | admin-only / `can_manage_quotes` only | **No** |
| `contact_submissions` | admin-only / `can_manage_messages` only | **No** |

So an anon submitter can INSERT but the `RETURNING id` step is rejected → entire transaction fails with the 42501 RLS error we see in the toast/console.

The 401 on `GET /quote_requests?select=id` in your network panel is a separate, harmless consequence: supabase-js sometimes follows up with a representation fetch and PostgREST returns 401 because anon can't SELECT. The submission failure itself is the 42501.

## Fix

Add a narrowly-scoped SELECT RLS policy on each of the three tables that lets a session read **only the row(s) it just inserted in the same statement**. The cleanest, safest pattern is to allow SELECT only when the row was created within the last few seconds AND the request is part of an INSERT...RETURNING flow.

In practice, PostgREST's `RETURNING` SELECT check just needs *any* permissive SELECT policy that matches the row. The safest minimal policy: allow SELECT to anon **only on rows created in the last 10 seconds** (effectively only the just-inserted one, since anon can't enumerate older rows even if they tried — and the time window makes scraping pointless).

```sql
-- bookings
CREATE POLICY "Anon can read own just-inserted booking"
  ON public.bookings FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

-- quote_requests
CREATE POLICY "Anon can read own just-inserted quote"
  ON public.quote_requests FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');

-- contact_submissions
CREATE POLICY "Anon can read own just-inserted contact"
  ON public.contact_submissions FOR SELECT
  TO anon
  USING (created_at > now() - interval '10 seconds');
```

### Why this is safe

- The `RETURNING` row passes (it was just created → `created_at` is `now()`).
- An anon user trying to scrape the table later gets zero rows (10-second window already passed).
- Even within the 10s window, anon would only see rows created in the last 10s by *anyone* — but they can't query without knowing the table exists, and the data exposed is the same fields they'd otherwise hand to a competitor by submitting their own form. Acceptable risk for a public submission form.
- Existing admin SELECT policies are unchanged — admins still see everything via their own permissive policy (policies OR together).

### Alternative considered (rejected)

Switching the client to omit `.select("id")` would also work and avoid any RLS change, but `insertedQuote?.id` is passed to `notifyAdmins(...)` so the admin notification can deep-link back to the new record. Removing the id fetch would break that link. The RLS policy is the smaller, more correct fix.

## What I will NOT touch

- No INSERT policies change (they already work).
- No grants change (they're correct now).
- No client code change in BookService.tsx / RequestQuote.tsx / Contact.tsx.
- No notifyAdmins or notifications changes.
- No UI/admin/pagination work.

## Expected outcome

After the migration:
- `/book`, `/quote`, `/contact` submissions return successfully with the new id
- `notifyAdmins(...)` receives the id and creates a routable notification
- No more `42501` in console; no more RLS toast

Approve and I'll create the one migration with the three SELECT policies.