

# Production Fixes Implementation Plan

## Overview

Four isolated fixes: transactional emails, double-booking RLS, spam protection, and contact form cleanup. Each is independent and non-breaking.

---

## Pre-Requisite: Email Domain Setup

Transactional emails require an email domain to be configured first. You'll need to set up an email domain before we can send confirmation emails.

---

## Fix 1: Transactional Email Notifications

**Dependency:** Email domain must be configured first.

**Steps:**
1. Set up email infrastructure using `setup_email_infra`
2. Scaffold transactional email edge function using `scaffold_transactional_email`
3. Create two edge functions:
   - `send-booking-confirmation` — accepts booking data, sends confirmation email with name, service, date/time, status
   - `send-quote-confirmation` — accepts quote data, sends confirmation email with name, service, description, status
4. Call these functions from `BookService.tsx` and `RequestQuote.tsx` **after** successful insert, wrapped in try/catch so failures don't block the submission
5. Use the transactional email send function (no external API keys needed)

**Files affected:**
- `supabase/functions/send-booking-confirmation/index.ts` (new)
- `supabase/functions/send-quote-confirmation/index.ts` (new)
- `src/pages/BookService.tsx` (add post-insert email call)
- `src/pages/RequestQuote.tsx` (add post-insert email call)

**Risk:** Zero to existing flows — email is fire-and-forget after successful insert.

---

## Fix 2: Double-Booking RLS Fix

**Steps:**
1. Create a database function `get_booked_slots(p_date date)` that returns `time_slot` values for confirmed/pending bookings on that date — runs as `SECURITY DEFINER` so anon can call it without needing SELECT on bookings
2. Update `BookService.tsx` to call `supabase.rpc('get_booked_slots', { p_date: dateStr })` instead of direct `.from("bookings").select("time_slot")`
3. No new RLS policies needed on the bookings table — the RPC function bypasses RLS safely

**Files affected:**
- New migration: create `get_booked_slots` function
- `src/pages/BookService.tsx` (change booked-slots query to use RPC)

**Risk:** Zero — additive change, admin policies untouched.

---

## Fix 3: Basic Spam Protection

**Client-side (all 3 forms):**
- After successful submit, disable the button for 30 seconds using a `useState` + `setTimeout` pattern
- Show countdown or "Please wait..." text

**Server-side (lightweight):**
- Create a database function `check_recent_submission(p_email text, p_table text)` that returns boolean if the same email submitted within the last 60 seconds
- Call this RPC before insert in `BookService.tsx`, `RequestQuote.tsx`, and `Contact.tsx`
- If true, show toast "Please wait before submitting again." and abort

**Files affected:**
- New migration: create `check_recent_submission` function
- `src/pages/BookService.tsx` (add cooldown + rate check)
- `src/pages/RequestQuote.tsx` (add cooldown + rate check)
- `src/pages/Contact.tsx` (add cooldown + rate check)

**Risk:** Zero — only adds guards before existing insert logic.

---

## Fix 4: Contact Form Logic + Admin Visibility

**A. Frontend fix:**
- `src/pages/Contact.tsx` line 126: change "Request a Quote" → "Send Message" and "Submitting..." → "Sending..."

**B. Data handling:**
- Already correct — Contact form writes to `contact_submissions` only. No change needed.

**C. Admin "Messages" page:**
- Create `src/pages/admin/MessagesAdmin.tsx` — simple list view of `contact_submissions` with name, email, message, date, status badge
- Add route in `src/App.tsx`
- Add nav item "Messages" in `src/lib/permissions.ts` under "operations" group
- Add icon mapping in `AdminLayout.tsx`

**D. Admin notification on contact submit:**
- Add `notifyAdmins("contact", "New contact message from [name]")` call in `Contact.tsx` after successful insert

**Files affected:**
- `src/pages/Contact.tsx` (button text + notification call)
- `src/pages/admin/MessagesAdmin.tsx` (new)
- `src/App.tsx` (add route)
- `src/lib/permissions.ts` (add nav item)
- `src/pages/admin/AdminLayout.tsx` (add icon)

**Risk:** Zero — additive only. Existing Submissions page untouched.

---

## Implementation Order

1. **Fix 2** — Double-booking RLS (migration + small frontend change)
2. **Fix 3** — Spam protection (migration + frontend changes)
3. **Fix 4** — Contact form + Messages admin (frontend only + notification)
4. **Fix 1** — Transactional emails (requires email domain setup first)

---

## Action Required

Before I can implement Fix 1 (transactional emails), you need to set up an email domain. Would you like to do that now?

