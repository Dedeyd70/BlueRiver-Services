# Plan: Cleaner recruitment workflow + email-link fix (new-DB-safe migrations)

Bundles the pending "Become a Cleaner" work with the applicant lifecycle, response emails, the broken admin-email-link fix, and a migration approach that is safe to run against a brand-new database.

## 0. Fix broken "Open Admin Dashboard" email link (bug)
The notification emails send `dashboardUrl` pointing at `/admin/...`, which does not exist — the real admin base is `/onpass-useradmin-blueriveracess052026`. That's why the link breaks.
- Add a single exported constant `ADMIN_BASE = "/onpass-useradmin-blueriveracess052026"` in `src/lib/permissions.ts` (reuse it internally too).
- Update the 3 call sites to use it:
  - `src/pages/BookService.tsx` → `${origin}${ADMIN_BASE}/bookings`
  - `src/pages/Contact.tsx` → `${origin}${ADMIN_BASE}/messages`
  - `src/pages/RequestQuote.tsx` → `${origin}${ADMIN_BASE}/quotes`
- New cleaner-application acknowledgement/response emails will use `${ADMIN_BASE}/cleaner-applications`.

## A. Application form (`src/pages/BecomeACleaner.tsx`)
- **Add Address** (required, validated, saved).
- **Two references** only (remove Reference 3 from the UI + schema).
- **Resume upload** — optional, **PDF/DOC/DOCX up to 5MB**, uploaded to a private bucket; path saved on the application. Filename shown with remove + clear error states.
- On submit: insert application, upload resume if present, send **auto-acknowledgement email** to applicant.

## B. Applicant lifecycle
Stages: **New → Reviewing → Shortlisted → Interview → Hired → Rejected** (stored in existing `status` text column; no enum lock-in). Each stage change + email recorded for audit.

## C. Admin review & response (`src/pages/admin/CleanerApplicationsAdmin.tsx`)
- Show **address** and **View Resume** (time-limited signed link, since bucket is private).
- Show 2 references.
- New status dropdown with the 6 stages + colored badges.
- **Respond & email** panel: pick a decision preset → pre-fills branded, **editable** subject + message → send:
  Invite to interview / Shortlisted / Request more info / Approved-Hired / Not moving forward.
- Sending records the email in history, stamps reviewed-by/at, and auto-advances the stage.
- **Response history** list per application.

## D. CTA wording (`src/pages/Index.tsx`)
- Rename hero + bottom **"Get a Free Quote" → "Request a Quote"** (matches rest of app).

## E. "Become a Cleaner" visibility
- Add **Become a Cleaner** button to homepage hero row (`src/pages/Index.tsx`).
- Surface a compact **Become a Cleaner** action in the **mobile top bar** in `src/components/Navbar.tsx` (desktop + in-menu links unchanged).

## Robustness (market-standard)
- Auto-acknowledgement on submit; full audit trail of stage changes + emails; private resume storage with signed links; existing 30s cooldown kept.

---

## Database changes — designed to run cleanly on a NEW database

All SQL will be **idempotent and self-contained** so `supabase db push` against a fresh DB works in order:

1. **Alter `cleaner_applications`** (all `ADD COLUMN IF NOT EXISTS`):
   `address text`, `resume_url text`, `reviewed_at timestamptz`, `reviewed_by uuid`.
   (`reference_3` is left in place but unused — dropping it is optional and avoided to prevent breaking older rows/migrations.)

2. **New table `cleaner_application_responses`** created with the required 4-step order (CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY), all guarded with `IF NOT EXISTS` / `DROP POLICY IF EXISTS`:
   columns: `id`, `application_id` (FK → cleaner_applications, `ON DELETE CASCADE`), `decision text`, `subject text`, `body text`, `recipient_email text`, `sent_by uuid`, `sent_at timestamptz default now()`.
   Grants: `authenticated` (CRUD) + `service_role`; **no anon**. RLS: only `has_role(admin)` OR `has_permission('can_manage_applications')` for all commands.

3. **Permission key**: ensure `can_manage_applications` exists in `permission_registry` (idempotent upsert) so it works on a new DB.

Because these use `IF NOT EXISTS` guards, they are also safe to re-run on the current dev DB with no behavior change.

## Manual steps required on the NEW database (outlined so nothing is missed)
These cannot be done purely by table migrations and must be handled explicitly:

1. **Create the private storage bucket `cleaner-resumes`** (private = not public). On this project I'll create it via the storage tool; on a self-hosted/new project it must be created before resume uploads work.
2. **Storage RLS policies on `storage.objects`** for that bucket (added via migration, but listed here since they live outside the app tables):
   - allow **anonymous INSERT** limited to `bucket_id = 'cleaner-resumes'` (public applicants upload their resume),
   - allow **admin / `can_manage_applications` SELECT** for signed-URL downloads,
   - no public read.
3. **Email**: relies on the already-deployed `send-transactional-email` function + `RESEND_API_KEY` secret and the verified sender `info@blueriverservices.co`. On a new project these must exist for acknowledgement/response emails to send (the function is in `supabase/functions/` and deploys automatically; the secret must be set).
4. **`can_manage_applications` permission** must be granted to any manager/staff users who should manage applications (admins bypass via role). Handled by the registry upsert above, but role assignment per user is manual in the admin Permissions screen.

## Technical notes
- Email sending reuses the existing function's `custom` type (`to`, `subject`, `html`) — a small typed helper (`src/lib/notifications.ts` or new `src/lib/applicantEmail.ts`) keeps calls consistent. No new email infrastructure.
- Resume validation is client-side (type + size); server stays lenient but bucket is private.
- No pricing/business-logic changes. All other app functionality is preserved.
