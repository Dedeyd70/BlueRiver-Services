## Goal

Remove all `mailto:` triggers from form/admin email actions and route every transactional send through the existing `send-transactional-email` Edge Function (Resend). Standardize success toast and silent error handling.

## Scope

Mailto links used purely as contact info (Contact.tsx, Footer.tsx, PrivacyPolicy.tsx) will be **kept** — they are display links, not form triggers. Only programmatic mailto launches will be removed. `src/lib/mailto.ts` will be deleted.

## Changes

### 1. Public forms — already invoke the function; just standardize

**`src/pages/BookService.tsx`** (around line 412)
- Confirm payload: `{ type: "booking_confirmation", to: email, data: { name, service, date, timeSlot, address, total } }`.
- Wrap in `try/catch` → `console.error` on failure, then ALWAYS show success toast:
  > "Check your inbox for a confirmation from info@blueriverservices.co. If you don't see it, please check your spam folder and mark us as a safe sender!"

**`src/pages/RequestQuote.tsx`** (around line 228)
- Confirm payload: `{ type: "quote_received", to: email, data: { name, service, address } }`.
- Same try/catch + same success toast string.

**`src/pages/Contact.tsx`**
- Add `supabase.functions.invoke("send-transactional-email", { body: { type: "custom", to, subject, html } })` on successful submit (currently sends none). Use a small inline HTML acknowledgement. Same success toast appended.

### 2. Admin actions — replace `openMailto` with edge function

**`src/pages/admin/BookingsAdmin.tsx`**
- `handleConfirm` (L197): replace `openMailto` → `supabase.functions.invoke("send-transactional-email", { body: { type: "booking_confirmation", to: b.email, data: { name, service, date, total } } })`.
- `handleSendInvoice` (L314): replace with `type: "custom"` call providing `subject` + `html` derived from invoice (number, total, due date). Toast: "Invoice emailed to {email}".
- Remove `openMailto`/`MAIL_TEMPLATES` import.

**`src/pages/admin/QuotesAdmin.tsx`**
- `markInProgress.onSuccess` (L268): replace with `type: "custom"` call (subject/html from `quoteInProgress` template content rendered as HTML).
- `handleSendQuote` (L450): replace with `type: "custom"` call (subject/html for "Your Quote from BlueRiver").
- Remove `openMailto`/`MAIL_TEMPLATES` import.

All admin replacements use try/catch → `console.error` on failure but keep the existing success toast so the UI flow continues.

### 3. Cleanup

- Delete `src/lib/mailto.ts`.
- Update `src/pages/admin/__tests__/AuditTrail.test.ts` mailto comments to reference the edge function instead.
- Verify `FullFlow.test.tsx` still passes with the standardized toast string.

### 4. Edge function

No changes required — `send-transactional-email` already supports `booking_confirmation`, `quote_received`, and `custom` types with branded HTML.

## Files Touched

- `src/pages/BookService.tsx`
- `src/pages/RequestQuote.tsx`
- `src/pages/Contact.tsx`
- `src/pages/admin/BookingsAdmin.tsx`
- `src/pages/admin/QuotesAdmin.tsx`
- `src/pages/admin/__tests__/AuditTrail.test.ts`
- Delete `src/lib/mailto.ts`

## Out of Scope

- Display-only `mailto:` links on Contact/Footer/PrivacyPolicy pages (kept; they are user-initiated contact links, not automated triggers).
- Switching to Lovable Emails infrastructure (project is locked to Resend per prior decision).