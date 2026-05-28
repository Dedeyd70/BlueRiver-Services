
# Become a Cleaner — Recruitment Feature

## 1. Navigation CTA
- `src/components/Navbar.tsx`: Add a new "Become a Cleaner" button next to "Request a Quote" on desktop, using the existing `Button variant="nav"` styling (consistent design tokens, no new colors). Mirror it in the mobile drawer alongside the quote button. Routes to `/become-a-cleaner`.

## 2. New Page: `/become-a-cleaner`
- New file `src/pages/BecomeACleaner.tsx`, registered in `src/App.tsx` under `PublicLayout` routes.
- Layout mirrors reference structure (hero header → intro copy → application form card) but uses BlueRiver tokens: hero gradient, `glass-surface` card, `font-display` heading, primary/foreground tokens.
- Sections:
  1. Hero: title "Join Our Cleaning Team", short tagline, `PageMeta` SEO.
  2. "Why Join Us" 3-card grid (flexible schedule, fair pay, supportive team) — copy only, no image dependency.
  3. Application form card (see §3).

## 3. Application Form
- Built with `react-hook-form` + `zod` (matching existing forms like `Contact.tsx` / `RequestQuote.tsx`).
- Fields (all required unless noted):
  - Full Name (text, 2–100 chars)
  - Email (email)
  - Phone (validated via existing `isValidUSPhone` from `validation.ts`)
  - Availability (select: Full-time, Part-time, Weekdays, Weekends, Flexible)
  - Years of Experience (select: None, <1, 1–2, 3–5, 5+)
  - **Service Type** (required radio group): "House Cleaning Only" | "Roof Cleaning Only" | "Both House & Roof Cleaning"
  - Short bio / why you want to join (textarea, optional, max 1000)
- Uses shadcn `Input`, `Textarea`, `RadioGroup`, `Select`, `Label`, `Button` — no custom color classes.
- Submit → insert into `cleaner_applications` table via Supabase client.
- Success state: replace form card with a confirmation panel — heading "Application Submitted Successfully!" and the required body copy, plus a "Back to Home" button. Also fire a toast.
- Rate limit: reuse the 30s client cooldown pattern used in `Contact.tsx` / `RequestQuote.tsx` (localStorage timestamp key).

## 4. Database (Lovable Cloud)
New table `public.cleaner_applications`:
- Fields: full_name, email, phone, availability, experience, service_type (text; CHECK constraint restricts to the 3 allowed values), message (nullable), status (text, default 'new'), created_at, updated_at.
- GRANTs: `INSERT` to `anon` + `authenticated`; `SELECT/UPDATE/DELETE` to `authenticated` only; `ALL` to `service_role`.
- RLS:
  - Anyone (anon + auth) can `INSERT` (public form).
  - Only admins (`has_role(auth.uid(), 'admin')` or holders of a new `can_manage_applications` permission, matching existing submissions patterns) can `SELECT/UPDATE/DELETE`.
- Realtime: **append** `cleaner_applications` to the existing `supabase_realtime` publication using `ALTER PUBLICATION supabase_realtime ADD TABLE public.cleaner_applications`. **Do not drop, recreate, or overwrite the publication** — all currently-published tables (`bookings`, `quote_requests`, `contact_submissions`, `notifications`, etc.) must remain untouched. The migration must only `ADD TABLE`, never `DROP PUBLICATION` or `CREATE PUBLICATION supabase_realtime`.

## 5. Admin Inbox Entry
- New route `/onpass-useradmin-blueriveracess052026/cleaner-applications` → `src/pages/admin/CleanerApplicationsAdmin.tsx`.
- List view modeled on `Submissions.tsx`: filters (status: new/reviewed/contacted/archived), `CollapsibleRecordCard` per application showing all fields, status dropdown + delete.
- Add link in `AdminLayout` sidebar under the existing Submissions group, gated by the new `can_manage_applications` permission (also accessible to admins).
- **Notification badge aggregation:** wire `cleaner_applications` into the existing notifications pipeline (`src/lib/notifications.ts` + `NotificationBell`) so a new application inserts a row into `notifications` with `reference_type: 'cleaner_application'` and routes to the new admin page on click. The header bell's unread count already aggregates from the `notifications` table, so the new feed contributes to the same total — explicitly verify the badge equation is `unread(messages) + unread(quotes) + unread(bookings) + unread(invoices) + unread(cleaner_applications)` with no source double-counted or missed. Add `cleaner_application → /…/cleaner-applications` to the `referenceRoutes` map in `NotificationBell.tsx`.

## Technical notes
- No design-system or token changes; reuse `hero-gradient`, `glass-surface`, `font-display`, `Button` variants.
- All Zod messages use the project's existing tone.
- No edge function needed — direct insert + RLS is sufficient (same as Contact/Quote).
- Out of scope: file/resume uploads, email notifications to applicant, scheduling interviews.

## Order of execution
1. Migration: create `cleaner_applications` table + GRANTs + RLS + register `can_manage_applications` in `permission_registry` + **append** to `supabase_realtime` publication (no drop/recreate).
2. Add Zod schema + form page + route.
3. Update Navbar (desktop + mobile).
4. Build admin list page + sidebar link + extend `NotificationBell` route map + insert-notification trigger on new applications.
5. Verify: build passes; submit a test application; confirm it lands in admin inbox, fires a notification, and the bell badge increments by exactly 1.
