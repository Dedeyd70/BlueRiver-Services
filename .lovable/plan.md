
## Goal
Expand the Become a Cleaner feature so the application captures the full client-requested field set, while keeping the existing layout, validation patterns, and admin UX intact.

## 1. Database migration
Add nullable columns to `public.cleaner_applications` (no destructive changes, existing rows stay valid):

```sql
ALTER TABLE public.cleaner_applications
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS has_license BOOLEAN,
  ADD COLUMN IF NOT EXISTS reference_1 TEXT,
  ADD COLUMN IF NOT EXISTS reference_2 TEXT,
  ADD COLUMN IF NOT EXISTS reference_3 TEXT,
  ADD COLUMN IF NOT EXISTS authorized_to_work BOOLEAN,
  ADD COLUMN IF NOT EXISTS personality_bio TEXT;
```

Existing RLS policies, GRANTs, and realtime publication remain untouched. Supabase types will regenerate automatically after the migration.

## 2. Public form — `src/pages/BecomeACleaner.tsx`

### Field changes
- Split `full_name` into **First Name** (required) + **Middle Name** (optional) + **Last Name** (required). On submit, compose `full_name = "{first} {middle?} {last}"` so the existing column stays populated; persist `middle_name` separately.
- Add **"Do you have a Driver's License?"** — required Yes/No `RadioGroup`, persists to `has_license` (boolean).
- Add **"Are you currently authorized to work in the United States?"** — required Yes/No `RadioGroup`, persists to `authorized_to_work` (boolean).
- Replace the free-form "About" textarea with a dedicated **"Describe your personality in not more than 300 words"** textarea bound to `personality_bio`, with a live word counter under the field. Submit is blocked when word count > 300; counter turns destructive color past the limit.
- Add a **References** section with three required `Input` fields:
  - "Reference 1 (Current or Former Supervisor — Name & Contact)"
  - "Reference 2 (Professional Reference — Name & Contact)"
  - "Reference 3 (Professional Reference — Name & Contact)"

Keep existing fields: Email, Phone, Availability, Years of Experience, Service Type (radio).

### Validation
Extend the Zod schema with the new fields (booleans coerced from "yes"/"no" radio string), a `personality_bio` refinement that counts whitespace-split words ≤ 300, and required-field messages mirroring existing style. Reuse existing `isValidEmail` / `isValidUSPhone` checks.

### Submit payload
Insert all new columns alongside existing ones. Preserve the 30 s `localStorage` cooldown, `notifyAdmins` call, success panel, and toast — no styling changes to surrounding hero / "Why join" cards.

## 3. Admin view — `src/pages/admin/CleanerApplicationsAdmin.tsx`
- Extend the `CleanerApplication` TS interface with the new optional fields.
- In the expanded detail grid, add labeled rows for: Middle Name, Driver's License (Yes/No/—), Work Authorization (Yes/No/—), References 1–3 (each on its own row, monospace-friendly), and the Personality Bio (full-width, `whitespace-pre-wrap`, replaces the current generic "About" block).
- Keep existing card chrome, status badges, status dropdown, delete dialog, and pagination unchanged.

## 4. Verification
- Submit a test application from `/become-a-cleaner` with all fields filled; confirm row in `cleaner_applications` has every new column populated and `full_name` correctly composed.
- Confirm word-count limit blocks submission at 301 words.
- Open admin inbox at `/admin/cleaner-applications`, expand the new record, and verify every new field renders cleanly at mobile + desktop widths.
- Confirm legacy rows (without the new columns) still render without crashes (fields show "—").

## Out of scope
File/resume uploads, NAR/HCA/CNA certifications, email notifications beyond the existing `notifyAdmins`, or any changes to navbar, routing, or notification badge wiring.
