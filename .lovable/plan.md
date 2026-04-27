## Frontend-Only Safe-Mode Refactor

**Scope:** UI/frontend only. No DB, RPC, RLS, or schema changes.

---

### Audit findings (current direct inserts / business logic in UI)

| File | Line | Issue |
|------|------|-------|
| `src/pages/admin/QuotesAdmin.tsx` | 314 | Direct `bookings.insert` from "Convert Quote → Booking". Recalculates subtotal/tax/total in JS. |
| `src/pages/admin/InvoicesAdmin.tsx` | 120 | Direct `invoices.insert` for manual invoice creation. Recalculates `tax_amount` and `total_amount` in JS. |
| `src/pages/admin/InvoicesAdmin.tsx` | 160 | Direct `invoices.update` for payments — acceptable for *partial* payments (no RPC exists), but full payment must go through `mark_invoice_paid` (already does ✅). |
| `src/pages/BookService.tsx` | 274 | Public customer-facing booking form direct insert. **No RPC equivalent exists.** |
| `src/pages/admin/BookingsAdmin.tsx` | — | Already correct: uses `createInvoiceFromBooking` (RPC wrapper) on "Mark Completed". Missing source-based button conditioning. |

---

### Planned changes

#### 1. `QuotesAdmin.tsx` — Quote→Booking via RPC
- Replace the `supabase.from("bookings").insert(...)` block (lines ~289–354) with `supabase.rpc("convert_quote_to_booking", { p_quote_id: selectedQuote.id })`.
- Remove all client-side snapshot math (`snapshotSubtotal`, `snapshotTaxAmount`, `snapshotTotal`) — the RPC already snapshots `line_items` + `total` from the quote.
- ⚠️ **Caveat to flag to user:** the current RPC body (visible in db-functions context) only inserts `quote_id`, `service_type_id`, `line_items`, `total_price`. It does **not** copy `name/email/booking_date/time_slot/address/property snapshot/custom_fields/source='quote'`. Per the system-role rules, we **cannot modify the RPC**. After the RPC returns the new booking, the frontend will issue a follow-up `bookings.update` (allowed — not an insert) to populate the scheduling fields (`booking_date`, `time_slot`, `status`) and contact/property snapshot fields the RPC omits. This keeps creation through the RPC while still capturing user-selected scheduling data.
- Keep the post-creation `quote_requests.update` (status→converted), `booking_activity_logs.insert`, and `notifyAdmins` calls — these are not financial-record creations.

#### 2. `InvoicesAdmin.tsx` — Manual invoice creation
- The "Create Invoice" form currently inserts directly. The available RPC is `create_invoice_from_booking(p_booking_id)` which **requires a booking**.
- Change behavior: the manual create dialog will **require selecting a booking**, then call `supabase.rpc("create_invoice_from_booking", { p_booking_id })`. Remove client-side `tax_amount` / `total_amount` math.
- Remove the standalone fields (`subtotal`, `tax_rate`, `services[]`, `customer_name/email`) from the create form, since they are now sourced from the booking snapshot by the RPC.
- Notes / payment_method / due_date entered in the dialog will be applied via a follow-up `invoices.update` on the returned invoice id (non-financial fields, no recalculation).

#### 3. `InvoicesAdmin.tsx` — Payment flow
- Already routes full payment through `mark_invoice_paid` ✅ — no change.
- Partial-payment update (lines 160–172) stays as-is (no RPC exists for partial payments; this only writes `amount_paid` / `payment_status='partial'`, not totals).

#### 4. `BookingsAdmin.tsx` — Source-based action buttons
- Add conditional rendering for `b.source === 'quote'` vs manual:
  - **Quote-sourced**: View Invoice, Send Invoice, Mark as Paid, Generate Receipt. **Hide "Generate Invoice"** (invoice was auto-created on completion, or will be reused via RPC).
  - **Manual**: Generate Invoice, View Invoice, Send Invoice, Mark as Paid, Generate Receipt.
- "View Invoice" / "Send Invoice" / "Mark as Paid" / "Generate Receipt" buttons will look up the invoice by `booking_id` and:
  - View → open existing invoice (navigate / dialog).
  - Send → call existing `generateInvoicePdf` + email handler (no DB writes).
  - Mark as Paid → `supabase.rpc("mark_invoice_paid", { p_invoice_id })`.
  - Generate Receipt → no-op confirmation (receipts auto-create on `mark_invoice_paid`); button only shown if invoice already paid and links to existing receipt.

#### 5. `BookService.tsx` (public booking form) — **out of scope, flagged**
- This is a public anon-user insert with no RPC equivalent. Removing the insert would break customer bookings.
- **Recommendation (not done in this pass):** add `source: 'manual'` to the insert payload so admin UI can branch correctly. This is a single-field addition, not new business logic. ✅ Will include this minimal change.

#### 6. Cleanup
- Remove now-dead helpers in `QuotesAdmin.tsx`: `snapshotSubtotal`, `snapshotTaxAmount`, `snapshotTotal` calc block.
- Remove `tax_rate`, `subtotal`, `services` fields from `InvoiceForm` interface and `emptyForm` in `InvoicesAdmin.tsx`.

---

### Files touched
- `src/pages/admin/QuotesAdmin.tsx`
- `src/pages/admin/InvoicesAdmin.tsx`
- `src/pages/admin/BookingsAdmin.tsx`
- `src/pages/BookService.tsx` (one-line `source: 'manual'` only)

### Files NOT touched
- All SQL migrations, RPCs, RLS, triggers (per instructions).
- `src/lib/createInvoiceFromBooking.ts` (already a clean RPC wrapper).

---

### Open question for your approval
The `convert_quote_to_booking` RPC does not capture `booking_date`, `time_slot`, contact info, or `source='quote'`. My plan calls the RPC and then does a follow-up `bookings.update` (not an insert) to populate these. **Alternative:** ask you to extend the RPC server-side to accept these as parameters — but that violates the "frontend-only" constraint of this task. Confirm the follow-up-update approach is acceptable, or I can defer the Quote→Booking change until the RPC is extended.