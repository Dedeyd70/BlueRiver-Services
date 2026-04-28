## Root cause (confirmed via DB inspection)

The `anon` role has **no table-level grants** on `bookings`, `quote_requests`, or `contact_submissions`. Postgres rejects the INSERT with `42501 permission denied for table bookings` **before** RLS policies are even evaluated — so the existing "Allow public booking creation" / "Anyone can submit quote requests" / "Anyone can submit contact form" policies are dead letters.

Verified with `has_table_privilege`:

| table | anon INSERT | authenticated INSERT |
|---|---|---|
| bookings | **false** | true |
| quote_requests | **false** | true |
| contact_submissions | **false** | true |
| notifications | true | true |
| services | true | true |

`notifications` and `services` work for anon because they kept the default Supabase grants. The three submission tables were stripped at some point.

## Fix

One small SQL migration that re-grants `INSERT` (and `SELECT` where required by `.select("id").maybeSingle()` after insert) to `anon` and `authenticated` on the three affected tables. RLS already restricts what can actually be inserted/read, so this only re-opens the door RLS expects to guard.

```sql
GRANT INSERT ON public.bookings           TO anon, authenticated;
GRANT INSERT ON public.quote_requests     TO anon, authenticated;
GRANT INSERT ON public.contact_submissions TO anon, authenticated;

-- The forms call .select("id").maybeSingle() after insert, which needs SELECT.
-- RLS on bookings/quote_requests/contact_submissions still blocks anon from
-- reading other rows; the INSERT...RETURNING path is allowed because the row
-- being returned is the one anon just created.
GRANT SELECT ON public.bookings           TO anon, authenticated;
GRANT SELECT ON public.quote_requests     TO anon, authenticated;
GRANT SELECT ON public.contact_submissions TO anon, authenticated;
```

Note: the existing SELECT RLS on these tables is admin-only (or permission-gated), so granting SELECT to anon at the table level does **not** expose data — RLS still filters it to zero rows for anon. We only get the `RETURNING id` row back because anon is the inserter and the returned row passes through the insert path, not a fresh SELECT scan.

Actually, to be safe and avoid any chance of `INSERT ... RETURNING` being blocked by SELECT RLS, I'll add a focused SELECT policy that only lets anon read rows they could have just inserted is overkill. The simpler, correct approach: PostgREST's `.select()` after insert uses the `RETURNING` clause which is governed by the INSERT policy's WITH CHECK — no separate SELECT RLS check is required. So **only INSERT grants are strictly needed**. I'll keep the SELECT grants out to minimize surface area.

Final migration:

```sql
GRANT INSERT ON public.bookings           TO anon, authenticated;
GRANT INSERT ON public.quote_requests     TO anon, authenticated;
GRANT INSERT ON public.contact_submissions TO anon, authenticated;
```

## Entry points audited

All four public forms hit one of these three tables:

| Page | Table | Status after fix |
|---|---|---|
| `/book` (`BookService.tsx`) | `bookings` | Fixed |
| `/quote` (`RequestQuote.tsx`) | `quote_requests` | Fixed |
| `/contact` (`Contact.tsx`) | `contact_submissions` | Fixed |
| "Book Now" buttons on Services/Index | navigate to `/book` | Fixed (same table) |

`notifications` (called by `notifyAdmins` from all three forms) already has correct anon grants — no change needed.

## What I will NOT touch

- No UI changes. The diagnostic toast added last round stays so we can confirm success.
- No RLS policy changes — the existing INSERT policies are correct.
- No changes to `notifyAdmins` or `src/lib/notifications.ts`.
- No admin-side / pagination work.

## After applying

User submits a booking → expected outcome: success toast, no `42501` in console. If a different error surfaces (e.g. NOT NULL on a column), the diagnostic toast will name it and we handle it as a follow-up.

Approve and I'll create the one-statement migration.