

# SQL Schema Export — BlueRiver Database

## What you'll receive

A single downloadable `.sql` file at `/mnt/documents/bluerivers_schema.sql` containing the full current state of the `public` schema, organized in install order so it can be replayed against an empty database.

## File contents (in order)

1. **Header** — generated date, project ref, source.
2. **Extensions** — `uuid-ossp` (used by `faqs.id`).
3. **Custom types** — `app_role` enum (`admin`, `manager`, `staff`).
4. **Sequences** — `invoice_number_seq` (used by invoice numbering).
5. **Tables (24)** — full `CREATE TABLE` for every public table with exact column types, nullability, defaults, primary keys, and unique constraints:
   - `availability_settings`, `blocked_dates`, `bookings`, `branding_settings`, `condition_settings`, `contact_submissions`, `faqs`, `gallery`, `homepage_images`, `invoices`, `notifications`, `page_content`, `permission_registry`, `quote_drafts`, `quote_notes`, `quote_requests`, `service_fields`, `service_pricing_rules`, `service_types`, `services`, `site_settings`, `social_links`, `testimonials`, `user_roles`.
6. **Indexes (~30)** — all primary-key, unique, and secondary indexes including the partial unique index `idx_unique_confirmed_booking_slot` that enforces double-booking prevention.
7. **Functions (6)** — `generate_invoice_number()`, `get_booked_slots(date)`, `check_recent_submission(text,text)`, `has_permission(uuid,text)`, `has_role(uuid,app_role)`, `update_updated_at_column()` — full bodies with `SECURITY DEFINER` and `search_path` settings preserved.
8. **Triggers** — none currently exist (confirmed via `pg_trigger`); a comment noting this will be included.
9. **RLS** — `ALTER TABLE … ENABLE ROW LEVEL SECURITY` for every table, followed by every policy reproduced verbatim (all ~60 policies, grouped per table).
10. **Foreign keys** — none currently exist; included as a commented-out section noting the implied relationships from prior introspection (so the document is self-describing without falsely claiming FKs that aren't there).

## Disclaimers in the file

- Tables `auth.*`, `storage.*`, and other Supabase-managed schemas are **excluded** — only `public` schema is exported.
- Storage bucket `site-images` (public) noted as a comment, not as SQL (buckets are managed via Supabase API, not DDL).
- Secrets and edge functions are not part of database schema and are excluded.

## Deliverable

A single `<lov-artifact>` tag pointing to the generated SQL file, ready to download or paste into documentation.

