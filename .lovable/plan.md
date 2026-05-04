# Contact / Messages CRM Overhaul

## Diagnostics — Why activity doesn't truly log

`contact_submissions` has **no dedicated activity-log table**. `MessagesAdmin` fakes a log by appending stamped strings into the single `admin_notes` text column and parsing them back. As a result:

- Status changes (Mark Read / Mark Responded / Convert) don't write anywhere — the UI updates `status` only, no audit trail.
- There is no `actor_id`, so `RecordActivityPanel` always shows "Admin user".
- Replies to customers don't exist as a feature, so nothing logs them.

Fix: introduce a real `contact_activity_logs` table that mirrors `booking_activity_logs`, and write to it from every admin action (status change, note, reply, conversion).

---

## 1. Backend — `contact_activity_logs` + RPC

New migration:

- `contact_activity_logs` table: `id`, `contact_id` (FK contact_submissions), `actor_id`, `action` (`status_change` | `note` | `reply_sent` | `converted`), `previous_status`, `new_status`, `notes`, `details`, `created_at`. RLS: insert/select for admins + `can_manage_messages`.
- `log_contact_activity(p_contact_id, p_action, p_previous_status, p_new_status, p_notes, p_details)` SECURITY DEFINER RPC — sets `actor_id := auth.uid()` and inserts. Used by all client mutations so the actor is always real.
- Backfill: parse existing `admin_notes` per row into `note` entries (best-effort, single migration pass).

## 2. Smart Reply (transactional email + log)

In the expanded contact card, add a **Reply** section:

- Quick Templates dropdown — populated from a small constant map: `Standard Intro`, `Schedule a Site Visit`, `Commercial Inquiry Follow-up`, `Pricing Follow-up`, `Closing / Thank-you`. Selecting a template fills the textarea (admin can still edit).
- Subject input (default: `Re: Your inquiry to BlueRiver Services`).
- Body textarea.
- **Send Reply** button →
  - Calls existing `send-transactional-email` edge function with `type: "custom"`, `to: contact.email`, branded HTML wrapper around the typed body, `reply_to: info@blueriverservices.co` (already the function default).
  - On success: `log_contact_activity(action='reply_sent', notes=<body>, details=<subject>)` and auto-bumps status from `pending` → `read` (or `read` → `responded` if admin opts).
  - Failure surfaces a toast and is NOT logged.

The edge function already sets `reply_to: info@blueriverservices.co`, so customer replies route to the shared inbox. No webhook ingestion (out of scope; documented in the lifecycle summary).

## 3. One-click Convert to Quote with prefill

Refactor existing Convert dialog so the button instead **navigates to `/admin/quotes?prefillFromContact=<id>`** (or routes to the existing CreateQuote flow). `QuotesAdmin` reads the query param, fetches the contact row, and pre-fills Name / Email / Phone / Service / Description in the new-quote dialog. On save, it calls `log_contact_activity(action='converted', new_status='converted')` and updates the contact status. Existing in-line dialog stays as a fallback for the simple flow.

## 4. Status workflow: New | In Progress | Quoted | Archived

- Add a status `<Select>` in the card header replacing the loose buttons. Values map to existing column: `pending`→New, `read`→In Progress, `converted`→Quoted, `responded`→Archived. (Keeps schema/RLS unchanged; just relabels.)
- Every change calls `log_contact_activity(action='status_change', previous_status, new_status)`.
- Active vs Archived tabs key off the new mapping (Archived = `responded` + `converted`, same as today).

## 5. Admin UX uniformity

- Replace the fake parsed-notes feed with `RecordActivityPanel` driven by real `contact_activity_logs` rows (matches BookingsAdmin exactly).
- Wire `useAdminUserNames` so `actor_id` resolves to a real name.
- Action labels map: `status_change` → "Status changed", `note` → "Note", `reply_sent` → "Reply sent", `converted` → "Converted to quote".
- Notes stay supported; the Add-note flow now writes to `contact_activity_logs` instead of mutating `admin_notes`. (`admin_notes` column kept for legacy data, no longer written to.)

## 6. Backend integrity / Reply-To

- All outbound replies use the existing `send-transactional-email` function which already sets `reply_to: info@blueriverservices.co` and the verified `From`. Customer email replies land in the shared inbox naturally.
- True inbound-email tracking (parsing replies back into the activity log) requires Mailgun/Resend inbound webhooks + a parsing function — flagged as out of scope; the plan documents the workaround (Reply-To routing).

---

## Files

- **New**: `supabase/migrations/<ts>_contact_activity_logs.sql`
- **New**: `src/components/admin/ContactReplyComposer.tsx` (template dropdown + subject + body + send)
- **Edit**: `src/pages/admin/MessagesAdmin.tsx` (real activity log fetch, status select, reply composer, convert nav)
- **Edit**: `src/pages/admin/QuotesAdmin.tsx` (read `?prefillFromContact=` and open prefilled new-quote dialog; emit `converted` log)
- **Edit**: `src/integrations/supabase/types.ts` (auto-regen)

## Out of scope

- Inbound email parsing (would need Mailgun/Resend inbound webhook + parser function).
- Schema rename of `contact_submissions.status` enum values; we keep the existing values and remap labels in the UI.

## Lifecycle summary (to deliver after execution)

```text
Submit (Contact.tsx)
  → row inserted into contact_submissions (status=pending)
  → notifyAdmins() → notifications row → bell badge
  → customer gets branded ack email (Resend)

Admin opens MessagesAdmin
  → status=pending shown as "New"
  → Admin picks template + edits body → Send Reply
      → send-transactional-email (reply_to info@blueriverservices.co)
      → log_contact_activity(action=reply_sent)
      → status auto → "In Progress"
  → Admin clicks Convert to Quote
      → /admin/quotes?prefillFromContact=<id>
      → New quote dialog opens prefilled (name/email/phone/service/desc)
      → On save: quote_requests row + log_contact_activity(action=converted)
      → contact status → "Quoted"
  → If no further action needed: status → "Archived"

Audit trail (contact_activity_logs) shows: who, what, when, with real admin name.
```

Reply **approve** to execute.
