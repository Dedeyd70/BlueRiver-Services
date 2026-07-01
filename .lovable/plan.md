# Sync all RLS policies: dev → remote

Bring the remote database's Row-Level Security fully in line with dev (dev is the source of truth) by generating one idempotent migration that re-enables RLS and recreates every current dev policy.

## What the migration does
1. **Enable RLS** on all 31 public tables that have policies (safe/no-op where already enabled):
   availability_settings, blocked_dates, booking_activity_logs, bookings, branding_settings, cleaner_applications, condition_settings, contact_activity_logs, contact_submissions, faqs, gallery, homepage_images, invoices, notifications, page_content, permission_registry, pricing_multipliers, quote_drafts, quote_notes, quote_requests, receipts, reviews, service_areas, service_fields, service_pricing_rules, service_types, services, site_settings, social_links, testimonials, user_roles.

2. **Recreate every policy** — for each of the **105 policies** currently on dev, emit:
   ```sql
   DROP POLICY IF EXISTS "<name>" ON public.<table>;
   CREATE POLICY "<name>" ON public.<table> FOR <cmd> TO <roles>
     USING (<qual>) WITH CHECK (<with_check>);
   ```
   The `DROP ... IF EXISTS` before each `CREATE` makes the whole script idempotent — it runs cleanly on remote (adds/updates missing or drifted policies) and on dev (recreates identical policies, no behavior change).

Policy breakdown being synced: 37 `ALL`, 44 `SELECT`, 10 `INSERT`, 9 `UPDATE`, 5 `DELETE`.

## How it's delivered
Created through the migration tool, so it runs against dev and is written as a proper migration file. You then `supabase db push` to apply it to remote. The generated SQL is taken verbatim from the live dev policy definitions (via `pg_policies`), so remote ends up an exact mirror.

## Important caveats
- **Prerequisite:** every table and the functions the policies reference (`has_role`, `has_permission`) and the `app_role` enum must already exist on remote. If a table is missing remotely, its policy statements will fail — that means the table itself was created outside the migration chain (same class of issue as `receipts`) and needs a `CREATE TABLE` first. If the push errors on a specific table, tell me and I'll add its definition.
- **Scope is `public` schema table policies only.** `storage.objects` policies (quote-attachments, site-images) are handled in your other security migration, not here. Table GRANTs and column-level changes are out of scope unless you want them added.
- This does **not** delete remote-only policies that don't exist on dev. If you want remote to be an exact match (dropping any extra policies that exist only on remote), say so and I'll add explicit drops for known legacy policy names.

## Result
After pushing, every public-table RLS policy on remote matches dev exactly, with RLS enabled everywhere it should be.
