# Phase 1 — Critical Fixes & Reviews Foundation

Approve to execute these in one pass.

## 1. Contact form 403 fix
- Audit `contact_submissions` insert path. Existing migrations already grant anon `INSERT` and `SELECT (id)`, so the 403 is most likely the `check_recent_submission` RPC missing `EXECUTE` for anon, or the `notify_admins` insert into `notifications` failing under anon RLS.
- Add migration: `GRANT EXECUTE ON FUNCTION public.check_recent_submission(text, text) TO anon, authenticated;` and verify `notifications` has an anon INSERT policy (it already does — confirm).
- Wrap `notifyAdmins` in Contact.tsx in try/catch so a notification failure never blocks the insert (already done — verify).

## 2. Invoice $0 total fix + Payment Instructions
- **Root cause**: `create_invoice_from_booking` copies `bookings.total_amount`. For quote-converted bookings where `quote_drafts.breakdown.total` was missing, this lands as 0. The PDF/email then shows $0.
- **Fix**:
  - Migration: backfill `invoices.total_amount` / `subtotal` from `line_items` sum where currently 0; update `create_invoice_from_booking` to compute totals from `line_items` when booking totals are 0.
  - In `BookingsAdmin.handleSendInvoice`, compute final total from line_items as a defensive fallback before sending.
- **Payment Instructions** added to:
  - `src/lib/invoicePdf.ts` — new "Payment Instructions" block above the thank-you line:
    > Pay via Zelle to **info@blueriverservices.co**. Include invoice # in the memo.
  - `send-transactional-email` invoice email body — same block in HTML footer.

## 3. Reviews table + automation skeleton
- **Migration**: `reviews` table with `id`, `booking_id` (FK bookings), `rating` (1–5), `comment`, `customer_name`, `is_public` (default false), `created_at`. RLS:
  - anon SELECT where `is_public = true`
  - admins full access via `has_role` / `can_manage_testimonials`
  - INSERT via SECURITY DEFINER RPC `submit_review(p_booking_id, p_email, p_rating, p_comment, p_name)` that verifies the email matches the booking and the booking status is `completed`.
- **Public route** `/review/:bookingId` (`src/pages/LeaveReview.tsx`):
  - Reads `email` from query string, posts via `submit_review` RPC, shows star-picker + comment + name.
  - Added to `src/App.tsx` routes.
- **Automation**: in `BookingsAdmin.tsx`, when status changes to `completed`, fire-and-forget invoke `send-transactional-email` with a new review-request HTML body containing the link `https://blueriverservices.co/review/<id>?email=<urlencoded>`.

## Files touched
- New SQL migration (grants, invoice backfill, reviews table + RPC)
- `src/lib/invoicePdf.ts` (Payment Instructions block)
- `supabase/functions/send-transactional-email/index.ts` (Payment Instructions footer in invoice emails)
- `src/pages/admin/BookingsAdmin.tsx` (line_items fallback total + review-request email on completed)
- `src/pages/LeaveReview.tsx` (new)
- `src/App.tsx` (route)

## Out of scope (Phase 2/3)
- FAQ CMS + dynamic stats + homepage testimonials section
- Service-area table + admin tab
- Booking form Commercial/Pets toggle, add-ons checklist
- Notes/Activity uniformity across Quotes/Contacts admins

Reply approve to execute.
