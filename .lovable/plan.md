## Professionalism & Parity + Mailto Email Workflows

Four areas in one pass: branded PDFs + line-item label fix; expanded card visibility + activity-log notes; quote-sourced action parity, archived-state safeguards, Modify Items, and Prepare-Quote add-on price autopopulation; standardized mailto templates for confirm / in-progress / send-quote / send-invoice.

---

### 1. Unified Branding & PDF Fixes

**`src/lib/invoicePdf.ts` & `src/lib/quotePdf.ts`**
- Letterhead band: navy fill (`#0F172A`), white business name + slate-300 tagline + contact line, plus a navy/blue rounded "BR" badge as logo placeholder (no asset upload required; later swap-in via `branding_settings.logo_url`).
- Theme accents: section headings + total row in primary blue (`#1E3A8A`); table rules in `#CBD5E1`; total row gets a subtle slate-100 fill.
- All math unchanged — still reads from the persisted invoice / quote draft row.
- **Item-label bug fix**: line-item reader becomes `String(s.name || s.title || "Item")` (engine writes `name`; old rows used `title`). Same change for `quotePdf.ts`.

---

### 2. Admin UI Visibility & Activity Log

**Itemized breakdown table on expand**
- BookingsAdmin: read-only `Item · Qty · Unit · Total` table from `b.line_items`, sorted base → room → addon → condition. Falls back to "No itemized data" for legacy bookings without `line_items`.
- QuotesAdmin: same table from `draft.line_items` (or "Quote not yet prepared").
- Existing add-on chip row stays as a compact summary above the table.

**Activity Log — admin notes + actor name**
- Migration: `ALTER TABLE public.booking_activity_logs ADD COLUMN IF NOT EXISTS notes text;` (existing RLS already covers it; `details` stays system-generated, `notes` is admin-authored).
- BookingsAdmin Activity section: a `Textarea` + "Add note" button below the entry list inserts `{ booking_id, action: 'note', notes, actor_id: auth.uid() }`.
- QuotesAdmin keeps `quote_notes` (existing) but uses the same admin-name resolver.
- Each entry header: `[Action label] by [Admin Name] · [timestamp]`, plus the system `details` line and (when present) the admin `notes` line.
- Admin name lookup: one cached `useQuery(['admin-users'])` calling `supabase.functions.invoke("list-admin-users")`, building `Record<userId, full_name | email>`. Fallbacks: `null actor` → "System", unknown id → "Unknown user".

---

### 3. Parity, Safeguards, Modify Items, Add-on Pricing

**Quote-sourced parity**
- BookingsAdmin: drop the `!isQuoteSourced` gate so every active booking shows `Generate Invoice` (when no invoice), then `View Invoice`, `Send Invoice`, `Mark as Paid` once an invoice exists. Same `can_manage_invoices` permission gating.

**Disable destructive buttons on archive/paid**
- When `archived === true` (cancelled OR completed+paid):
  - `Send Invoice` → rendered `disabled` with muted styling and tooltip "Booking archived — invoice already settled".
  - `Mark Completed` is already only shown for `confirmed`; confirm it stays hidden after completion.
  - Add a small "Archived" chip near the status pill.

**Modify Booking Items dialog**
- New `Modify Items` button (only when `!archived && status !== 'cancelled'` and `can_manage_bookings`).
- Dialog seeded from `b.line_items` with the same editable table pattern as QuotesAdmin: name / qty / unit / Total (auto), "Add line", trash to remove.
- On save: `recomputeFromLineItems(items, taxRate)` from `pricingEngine.ts`, then `update bookings set line_items, subtotal, tax_amount, total_amount, total_price=<total_amount>`. Write a `booking_activity_logs` row with `action='items_modified'` and `details` summarizing the delta (e.g. "Total: $420 → $480").
- Invalidate `['admin-bookings']`, `['admin-invoices-by-booking']`, `['admin-invoices']`.
- Guard: if a linked invoice exists AND `payment_status !== 'unpaid'`, block save with toast "Invoice already has payments — modify the invoice instead."

**Auto-populate add-on prices in Prepare Quote**
- Today: `openPrepare` only seeds `addons` from `selected_addons` when no draft exists, and even then add-ons land at `$0` because the public-form payload lacks price metadata.
- Fix:
  1. Cached `useQuery(['services-addons'])` selecting from `services` where `service_category='addon' AND is_active=true`. Build `Map<lowercase title, parseInt(price_starting)>`.
  2. When seeding line items, resolve each `selected_addons[i]` price by lookup; if not found, keep $0 and tag it `(price TBD)`.
  3. Even when a draft exists, merge any `selected_addons` from the request not yet represented as `addon`-type line items (idempotent by lowercased title).
- Keep legacy `draftForm.addons` array in sync with the merged add-ons (for the non-line-item PDF fallback path).

---

### 4. Mailto Email Workflows (exact templates)

A single helper `src/lib/mailto.ts` builds `mailto:` URLs and opens them via `window.location.href = ...`:

```
buildMailto({ to, subject, bodyTemplate, vars })
```

Each template uses the user's literal `%0D%0A` newlines as specified. Vars: `[Name]`, `[Service]`, `[Date]`. Service falls back to `service_type || 'cleaning service'`. Date is `format(booking_date, 'MMMM d, yyyy')`.

**BookingsAdmin — Confirm button** (`status='pending' → 'confirmed'`)
- After successful update, open:
  - Subject: `Booking Confirmed - BlueRiver Services`
  - Body: `Hi [Name],%0D%0A%0D%0AWe are thrilled to confirm your booking for [Service] on [Date]. We look forward to providing you with excellent service!%0D%0A%0D%0AThank you,%0D%0ABlueRiver Team`

**QuotesAdmin — Mark In Progress** (`status='requested' → 'in_progress'`)
- After successful update:
  - Subject: `Quote Request Received - BlueRiver Services`
  - Body: `Hi [Name],%0D%0A%0D%0AWe have received your quote request for [Service]. Our team is currently reviewing your details and will get back to you with a customized quote within 24 hours.%0D%0A%0D%0AThank you,%0D%0ABlueRiver Team`

**QuotesAdmin — Send Quote button** (new button next to "Download PDF" inside the prepared-quote section; visible only when a draft exists)
- Subject: `Your Quote from BlueRiver Services`
- Body: `Hi [Name],%0D%0A%0D%0AThank you for considering BlueRiver Services. Please find your detailed quote attached to this email.%0D%0A%0D%0ALet us know if you have any questions!%0D%0A%0D%0ABest,%0D%0ABlueRiver Team`
- We do not auto-attach (mail clients can't accept attachments via `mailto:`); the prior "Download PDF" button stays so admins can attach manually.

**BookingsAdmin — Send Invoice** (standardize existing)
- Subject: `Invoice from BlueRiver Services`
- Body: `Hi [Name],%0D%0A%0D%0AThank you for choosing BlueRiver. Please find your invoice for the completed service attached.%0D%0A%0D%0ABest,%0D%0ABlueRiver Team`

In every case the admin's mail client opens with To/Subject/Body prefilled. The action that triggered the mail (status update or DB write) still happens regardless of whether the admin actually sends the email.

---

### Files Edited
- `src/lib/invoicePdf.ts` — letterhead, theme colors, `name || title` fix.
- `src/lib/quotePdf.ts` — letterhead, theme colors, `name || title` fix.
- `src/lib/mailto.ts` — new helper for `buildMailto({...})` + the four template constants.
- `src/pages/admin/BookingsAdmin.tsx` — itemized table; remove `!isQuoteSourced` gate; archived disables + chip; Modify Items dialog (uses `recomputeFromLineItems`); activity-log textarea + admin-name rendering; mailto on Confirm and standardized Send Invoice.
- `src/pages/admin/QuotesAdmin.tsx` — itemized table; admin-name rendering on `quote_notes`; fix `openPrepare` add-on seeding (services-table price lookup + merge with existing draft); mailto on Mark In Progress; new Send Quote button.
- `src/pages/admin/InvoicesAdmin.tsx` — small itemized breakdown block in invoice card so admins see real names without opening the PDF.

### Migration
```sql
ALTER TABLE public.booking_activity_logs
  ADD COLUMN IF NOT EXISTS notes text;
```
No RLS changes — existing insert/select policies cover the new column.

### Out of scope (deferred)
- Editing line items on an invoice that already has payments — guarded with a toast.
- True transactional email send (would need an edge function + verified domain) — current pass uses mailto only.
- Logo upload UI — letterhead supports `branding_settings.logo_url` in a later pass; this pass uses the navy "BR" badge placeholder.