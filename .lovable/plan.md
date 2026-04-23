

# Phase 1 — Backend Robustness & Form Standardization

Six discrete deliverables. No existing data is destroyed; new columns are additive; existing forms keep working while gaining new fields.

---

## 1. Standardized property fields on both forms

Add the same field set to **RequestQuote** and **BookService**. Most columns already exist on `quote_requests`; bookings already has property_type/square_footage/has_pets/entry_codes — we just need to surface them and add the few missing ones.

**Schema additions** (migration):

| Table | New column | Type | Default |
|---|---|---|---|
| `bookings` | `floor_type` | text | NULL |
| `bookings` | `pet_count` | integer | NULL |
| `bookings` | `condition_level` | text | NULL |
| `bookings` | `is_empty_property` | boolean | false |
| `quote_requests` | `pet_count` | integer | NULL |

`property_type`, `square_footage`, `has_pets`, `entry_codes`, `condition_level`, `is_empty_property`, `floor_type` all already exist on `quote_requests` → no migration there.

**Form changes** — both `RequestQuote.tsx` and `BookService.tsx` get a unified "Property & Conditions" block:

- **Property Type** select → House, Apartment, Office, Townhome (controlled list, replacing the inconsistent options today)
- **Square Footage** numeric input
- **Floor Type** select → Hardwood, Carpet, Tile, Mixed
- **Pets in home** checkbox + conditional **Number of Pets** numeric input (only shows when checked)
- **Condition Level** select → Standard, Heavy, Post-Construction
- **Occupancy** select → Occupied / Empty (Move-out)
- **Entry Codes / Key Location** textarea (renamed label, same column)

All payload mapping uses the existing TYPED_FIELD_KEYS pattern in both files — extend the sets to include the new keys. Unknown values fall through to `custom_fields`.

---

## 2. Complete data snapshotting on Quote → Booking

Rewrite the `convertToBooking` mutation in `src/pages/admin/QuotesAdmin.tsx` so the new booking row is a **standalone snapshot**:

Fields copied from `quote_requests` → `bookings`:
- All contact + service: `name, email, phone, address, service_type, service_type_id, quote_id, consent_given`
- All property: `property_type, square_footage, floor_type, condition_level, is_empty_property, has_pets, pet_count, entry_codes`
- All room counts: `bedrooms, bathrooms, frequency`
- `notes` ← `quote_requests.description`
- `selected_addons` ← direct
- `custom_fields` ← merge of source `custom_fields` + any quote-only typed columns we don't have on bookings (kitchen_count, living_rooms, office_rooms, full_bathrooms, half_bathrooms, has_cabinets) so nothing is lost
- `total_price` ← from the linked `quote_drafts.line_items` total (subtotal+tax) if a draft exists; otherwise the engine total computed live; otherwise NULL

Booking remains valid even if the quote is later deleted — `quote_id` is preserved as a nullable reference but every property/price field is duplicated locally.

---

## 3. Booking activity log

**New table** `booking_activity_logs`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `booking_id` | uuid | required, FK target conceptually `bookings.id` |
| `action` | text | required (e.g. `confirmed`, `completed`, `cancelled`, `created`) |
| `details` | text | optional (cancellation reason, invoice number) |
| `previous_status` | text | nullable |
| `new_status` | text | nullable |
| `actor_id` | uuid | nullable (auth.uid of admin) |
| `created_at` | timestamptz | default `now()` |

RLS: SELECT/INSERT for admin, manager, staff (matching existing booking access patterns); no UPDATE/DELETE.

**Where it's written** — `src/pages/admin/BookingsAdmin.tsx`:

- `handleConfirm` → log `confirmed`
- `handleCompleted` → log `completed` with invoice number in `details`
- `handleCancelConfirm` → log `cancelled` with reason in `details`
- Also inside `convertToBooking` mutation in `QuotesAdmin.tsx` → log `created` with quote ID in `details`

**Where it's shown** — new "Activity" expandable section on each booking card in `BookingsAdmin.tsx`, mirroring how `quote_notes` are displayed in `QuotesAdmin.tsx`. Read-only timeline with timestamp + action label + actor email.

---

## 4. Notification deep-linking

Update `referenceRoutes` in `src/components/admin/NotificationBell.tsx` so each list page receives a `?focus=<id>` query param:

```text
booking  → /admin/bookings?focus=<reference_id>
quote    → /admin/quotes?focus=<reference_id>
contact  → /admin/messages?focus=<reference_id>
invoice  → /admin/invoices?focus=<reference_id>   ← new mapping
```

In each of the four destination pages:
- Read `focus` from `useSearchParams`.
- After data loads, scroll the matching card into view (`ref.scrollIntoView({behavior:"smooth", block:"center"})`).
- Apply a temporary highlight ring (`ring-2 ring-primary` for ~3s) so the admin sees which row was the target.
- For bookings: if the focused row's status is `pending` and the URL also has `?status=pending`, keep the existing tab filter behaviour intact.

No backend change — `notifications.reference_id` is already populated everywhere we need it.

---

## 5. Offline payment reconciliation on Invoices

Replace the free-text "Payment Method" input and add a structured Mark-as-Paid flow in `src/pages/admin/InvoicesAdmin.tsx`.

**Schema additions** (migration):

| Table | New column | Type | Default |
|---|---|---|---|
| `invoices` | `payment_date` | date | NULL |
| `invoices` | `payment_reference` | text | NULL (optional check #, txn id) |

`payment_method` already exists; we constrain it in the UI to a select.

**UI changes:**
- The existing "Mark Paid" button opens a dialog instead of one-shot updating.
- Dialog fields: **Method** select (Cash, Check, Bank Transfer, Square, Zelle, Other), **Date Received** date picker (default today), optional **Reference #**.
- On submit: update `amount_paid = total_amount`, `payment_status = 'paid'`, `payment_method`, `payment_date`, `payment_reference`.
- The "Add Payment" partial-payment dialog gets the same Method + Date fields and writes them too.
- The Manual Invoice creation form replaces its free-text method input with the same select.
- Invoice card display surfaces method + date + reference when present.
- PDF generator (`generateInvoicePDF`) prints the Method, Date, and Reference lines when paid.

---

## Files touched

| File | Change |
|---|---|
| New SQL migration | Add 5 columns to bookings, 1 to quote_requests, 2 to invoices; create `booking_activity_logs` table + RLS |
| `src/pages/RequestQuote.tsx` | Add Floor Type, Pet count, Occupancy, normalized Property Type list |
| `src/pages/BookService.tsx` | Same field additions; extend BOOKING_TYPED_KEYS / NUMERIC / BOOLEAN sets |
| `src/pages/admin/QuotesAdmin.tsx` | Rewrite `convertToBooking` to snapshot all property + price data; log activity |
| `src/pages/admin/BookingsAdmin.tsx` | Write to `booking_activity_logs` on every status change; render activity timeline; honour `?focus=` |
| `src/pages/admin/QuotesAdmin.tsx` | Honour `?focus=` |
| `src/pages/admin/MessagesAdmin.tsx` | Honour `?focus=` |
| `src/pages/admin/InvoicesAdmin.tsx` | Honour `?focus=`; structured Mark-Paid dialog; method select; payment date/reference |
| `src/components/admin/NotificationBell.tsx` | Add `?focus=` to nav; add `invoice` mapping |
| `src/lib/createInvoiceFromBooking.ts` | No change required |

## Compatibility guarantees

- All schema additions are nullable or have safe defaults — existing rows unaffected.
- Existing typed columns on `quote_requests` (kitchen_count, living_rooms, etc.) are kept and now mirrored into `bookings.custom_fields` on conversion. Nothing is dropped.
- `booking_activity_logs` is additive — old bookings simply have no historical entries; new ones start logging immediately.
- Notification deep-link uses query params, so old notifications without `reference_id` still open the correct list page (current behaviour preserved).
- Invoice `payment_method` continues to accept any string in DB; UI just constrains new entries. Legacy invoices keep their existing values.

