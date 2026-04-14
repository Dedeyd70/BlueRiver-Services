

# Coordinated Admin Fixes & Enhancements

## Overview
Six areas of work: database schema update, notification navigation, admin action logic with cancellation dialog and PDF generation, invoice form improvements, hero image desktop fix, and data integrity checks. No general UI style changes.

---

## 1. Database Migration

Add `cancellation_reason` (text, nullable) column to the `bookings` table.

```sql
ALTER TABLE public.bookings ADD COLUMN cancellation_reason text;
```

No other schema changes needed — the hero image already comes from `homepage_images` table which is accessible.

---

## 2. Notification Bell — Click-to-Navigate

**File: `src/components/admin/NotificationBell.tsx`**
- Import `useNavigate` from react-router-dom
- On notification click: mark as read, then navigate based on `reference_type`:
  - `"booking"` → `/admin/bookings`
  - `"quote"` → `/admin/quotes`
  - `"contact"` → `/admin/messages`
- Close the popover after navigation

**File: `src/pages/RequestQuote.tsx`** (line 101)
- Change `.insert({...})` to `.insert({...}).select("id").maybeSingle()`
- Pass the returned `id` as `reference_id` and `"quote"` as `reference_type` to `notifyAdmins`

**File: `src/pages/Contact.tsx`** (line 58)
- Change `.insert({...})` to `.insert({...}).select("id").maybeSingle()`
- Pass the returned `id` as `reference_id` and `"contact"` as `reference_type` to `notifyAdmins`

---

## 3. Admin Action Logic with Mimic Events

**File: `src/pages/admin/BookingsAdmin.tsx`**
- Install `jspdf` as a dependency
- Replace the generic status button row with three explicit action buttons:
  - **Pending**: Update status → `pending`. Toast: *"Reminders paused. Status set to Pending."*
  - **Completed**: Update status → `completed`. Generate a basic invoice PDF via jsPDF with booking data (name, email, service, date, total). Toast: *"Success! Generating Invoice PDF and mimic-queuing Thank You email..."*. `console.log` the customer payload and PDF blob.
  - **Cancelled**: Open a Dialog with a textarea for cancellation reason. On confirm: update status → `cancelled` + save `cancellation_reason`. Toast: *"Booking Cancelled. Client notified regarding: [reason]."*
- Add cancellation dialog state (`cancelTarget`, `cancelReason`)
- All mutations already call `invalidateQueries` — instant UI updates preserved

---

## 4. Invoice Form Improvements

**File: `src/pages/admin/InvoicesAdmin.tsx`**
- Add controlled state: `selectedBookingId` and `selectedQuoteId`
- When `prefillFromBooking` is called, set `selectedBookingId` and clear `selectedQuoteId` (and vice versa)
- Use controlled `value` prop on both `<Select>` components so they visually reset
- Add a "Download as PDF" button on each existing invoice card — uses jsPDF to generate a simple invoice PDF with customer name, services, total, dates
- Add loading awareness: if `bookings` or `quotes` queries are still loading when dialog opens, show a small spinner placeholder on the select fields

---

## 5. Hero Image Desktop Fix

**File: `src/pages/Index.tsx`**
- The hero section (line 126) already uses `min-h-[90vh]`, `w-full h-full object-cover` — these are correct
- Verify and ensure the `<div className="absolute inset-0">` container has no parent clipping. Currently the outer `<div className="overflow-hidden">` on line 120 wraps the entire page — this is fine
- Add `object-center` to the hero `<img>` tags (lines 134, 143) to ensure consistent centering on wide desktop screens
- Ensure the absolute-positioned image container stretches correctly with `w-full` (already present)

---

## 6. Data Integrity

**File: `src/pages/BookService.tsx`** (before the insert on line 173)
- After the rate-limit check, call `get_booked_slots` RPC for the selected date
- If `selectedSlot` is in the returned booked slots, abort with toast: *"This time slot was just booked. Please select another."*

**File: `src/pages/admin/Submissions.tsx`** (line 25-37)
- Add `read: "bg-blue-100 text-blue-800"` to the `statusColors` map

---

## Implementation Order
1. Migration: `cancellation_reason` column
2. Install `jspdf` dependency
3. NotificationBell navigation + form reference_id fixes
4. BookingsAdmin action logic + cancellation dialog + PDF generation
5. InvoicesAdmin mutual exclusivity + PDF export + loading state
6. Hero image `object-center` fix
7. BookService slot verification + Submissions status color

