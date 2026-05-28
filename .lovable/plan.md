## Goal
Produce a single consolidated SQL file containing every migration in `supabase/migrations/` in chronological order, so you can view and download the full schema in one place.

## Approach
1. List all 53 `.sql` files in `supabase/migrations/` sorted ascending by filename (filenames are timestamp-prefixed, so lexical sort = chronological).
2. Concatenate them into one file with a clear header before each migration:
   ```
   -- ============================================================
   -- Migration: <filename>
   -- ============================================================
   ```
3. Write the output to two locations:
   - `schema_migration_dump.sql` at the project root (so it appears in the file tree as requested).
   - `/mnt/documents/schema_migration_dump.sql` (so it shows up as a downloadable artifact in chat).

## Scope
- No application code, frontend, or migration files are modified.
- No database changes are run — this is pure file concatenation.
- The dump preserves the original SQL verbatim, including extensions, tables, constraints, FKs, RLS policies, GRANTs, functions, triggers, and realtime publication statements exactly as written in each migration.

## Deliverable
A single `schema_migration_dump.sql` file (also offered as a download artifact) containing all 53 migrations in chronological order.
