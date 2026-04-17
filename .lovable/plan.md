

# Quote → Booking → Invoice Workflow Refactor

Restructures the business logic, status flows, and admin actions across Quotes, Bookings, Invoices, and Submissions. UI layout is preserved — only buttons, statuses, and behaviours change.

---

## 1. Database Migrations (schema only)

**`bookings`** — add column:
- `quote_id uuid` (nullable) — links a booking back to its source quote.

**`invoices`** — add columns:
- `invoice_number text unique` — auto-generated `INV-YYYY-NNNN` via DB sequence + trigger.
- `tax_amount numeric default 0`, `tax_rate numeric default 0`.
- `subtotal numeric default 0`.

**`site_settings`** — seed two new keys (insert tool, not migration):
- `auto_approve_bookings` → `"false"`.
- `tax_rate` → `"0"`.

**`quote_requests`** — add column:
- `close_reason text` (nullable) — populated when a quote is closed.

No new tables. `quote_notes` already exists and serves as the activity log. No status enum is added (kept as `text` for flexibility), but **client code is the authoritative status gatekeeper**.

---

## 2. Status Mapping (data backfill via insert tool)

| Entity | Old statuses | New canonical statuses |
|---|---|---|
| Quotes | pending, reviewed, responded, converted, closed | **requested**, **in_progress**, **converted**, **closed** |
| Bookings | pending, confirmed, completed, cancelled | unchanged: **pending**, **confirmed**, **completed**, **cancelled** |
| Invoices | unpaid, partial, paid | unchanged |

Backfill: `pending → requested`, `reviewed → in_progress`, `responded → in_progress`. `converted` and `closed` stay.

---

## 3. `src/pages/admin/QuotesAdmin.tsx`

- Replace `statusColors` map with the 4 canonical statuses.
- **Remove** the row of `["pending","reviewed","responded","closed"]` toggle buttons (lines 270–282). Status is no longer toggled directly.
- Action buttons become:
  - **Mark In Progress** — visible only when status = `requested`. Sets status to `in_progress`.
  - **Convert to Booking** — visible only when status = `in_progress` AND at least one activity-log note exists. Disabled with tooltip otherwise.
  - **Close Quote** — opens dialog asking for reason → writes `close_reason` and sets status to `closed`.
  - **Generate Quote PDF** — renders the template (see §4) and downloads.
- Conversion dialog: existing date/time picker stays, but on submit it now **also writes `quote_id` onto the new booking** and respects `auto_approve_bookings` setting (status = `confirmed` if on, `pending` if off — instead of hard-coded `"confirmed"` on line 100).
- Activity log: every status change (Mark In Progress, Convert, Close) automatically inserts a `quote_notes` entry like *"Status changed to In Progress by admin"* so the log is the single source of truth.
- Archive tab continues to show `converted` + `closed`.

---

## 4. Quote PDF Template (`src/lib/quotePdf.ts` — new)

Single function `generateQuotePdf(quote, branding, settings, addons)` using existing `jsPDF`. Renders:

```text
[Logo from branding_settings]    BlueRiver Services LLC
                                 [tagline] · [phone] · [email]
─────────────────────────────────────────────────────────────
QUOTE  #Q-2025-NNNN                       Issued: <date>
                                          Valid until: <date+7d>

Bill to:                          Service location:
<name>                            <address>
<email>

Service Details
  • <service_type>
  • <description>

Pricing
  Base                                       $X.XX
  Add-on: <title>                            $X.XX
  Supplies fee                               $X.XX
  ─────────────────────────────────────────────
  Total                                      $X.XX

Availability
  Scheduling will be confirmed upon acceptance.

To proceed, please reply to this message or confirm
your booking with us.

This quote is valid for 7 days.

Thank you for choosing BlueRiver Services.
```

Called from a "Download Quote PDF" button on each active quote card.

---

## 5. `src/pages/admin/BookingsAdmin.tsx`

- **Remove** the "Pending" button (lines ~257–259) — pending is a state, never an action.
- Action buttons become:
  - **Confirm** — visible only when status = `pending`. Sets `confirmed`.
  - **Mark Completed** — visible when status = `confirmed`. Sets `completed` AND triggers automatic invoice creation (see §6). Existing inline jsPDF generation moves into the invoice flow so it's no longer fired here directly.
  - **Cancel** — opens reason dialog (already exists), sets `cancelled` + `cancellation_reason`.
- Auto-approve respect: when a booking is **created** (public form + quote conversion), default status reads `site_settings.auto_approve_bookings`. Public booking insert path is in `src/pages/BookService.tsx` — small change there to read the setting and use `confirmed` or `pending`.
- Archived tab unchanged (completed + cancelled).

---

## 6. `src/pages/admin/InvoicesAdmin.tsx` and auto-invoice flow

- **Remove** the "Pre-fill from Quote" select (lines 273–289) and the `quote_id` field on the form. Invoices are now bookings-only.
- **Remove** the "New Invoice" manual creation button — invoices are created automatically when a booking is marked Completed. (Manual override via "+ New" stays as an admin-only escape hatch but the form drops the quote selector.)
- Auto-creation logic lives in a new helper `src/lib/createInvoiceFromBooking.ts`:
  - Generates `invoice_number` via sequence (`INV-YYYY-NNNN`).
  - Copies customer details, services + addons from booking.
  - Computes `subtotal`, `tax_amount = subtotal * tax_rate`, `total_amount = subtotal + tax_amount`.
  - Sets `payment_status = "unpaid"`, `booking_id = b.id`.
- PDF generator updated to include invoice number + tax line.
- Existing payment recording flow unchanged.

---

## 7. `src/pages/admin/Submissions.tsx` — view-only

- **Remove** the delete button + AlertDialog (lines 149–162, 220–222, 74–90).
- **Remove** all mutation imports.
- Keep tabs, status filter, and read-only display. Add a small "Open in Bookings/Quotes/Messages" link on each row that navigates to the corresponding admin page.

---

## 8. `src/components/admin/AvailabilitySettings.tsx` (or new `GeneralSettings`)

Add an "Auto-Approve Bookings" toggle backed by `site_settings.auto_approve_bookings`, plus a Tax Rate input backed by `site_settings.tax_rate`. Reuses existing layout pattern.

---

## 9. Notifications

Already wired via `notifyAdmins` in submission paths. No structural change — just make sure quote conversion and booking completion fire a notification (`type: "quote_converted"`, `type: "booking_completed"`).

---

## 10. Files Touched (Summary)

| File | Type of change |
|---|---|
| **New migration** | `bookings.quote_id`, `invoices.invoice_number/tax/subtotal`, `quote_requests.close_reason` + invoice number sequence |
| `src/pages/admin/QuotesAdmin.tsx` | Refactor actions + new status flow + PDF button |
| `src/lib/quotePdf.ts` | NEW — quote template generator |
| `src/pages/admin/BookingsAdmin.tsx` | Remove "Pending" button, auto-invoice on Completed |
| `src/lib/createInvoiceFromBooking.ts` | NEW — shared auto-invoice helper |
| `src/pages/admin/InvoicesAdmin.tsx` | Remove quote-prefill, add invoice number/tax to PDF |
| `src/pages/admin/Submissions.tsx` | Strip mutations, view-only |
| `src/components/admin/GeneralSettings.tsx` | Add Auto-Approve toggle + Tax Rate |
| `src/pages/BookService.tsx` | Respect auto-approve setting on public submission |

UI structure, page routes, and visual design are unchanged. Only actions, statuses, and business rules are refactored.

