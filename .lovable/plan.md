# Final Consistency Audit & Polish

## Scope

A standardization pass across `InvoicesAdmin`, `MessagesAdmin` (the Contact admin page that currently owns the **Convert** button), `QuotesAdmin`, and `BookingsAdmin`, plus a written audit of the pricing flow. No DB schema changes. No RPC changes. No removal of working features.

> Note: `Submissions.tsx` is the unified read-only inbox that links out to the dedicated pages — the **Contact admin page with the Convert button is `MessagesAdmin.tsx`**, which is what this plan refactors. `Submissions.tsx` already shows a row-summary list and remains untouched.

---

## 1. InvoicesAdmin — collapsible + itemized + activity log

Refactor the card render to use `CollapsibleRecordCard`:

- **Collapsed summary (4 fields):** Customer · Total · Issued · Status (already in badge).
- **On expand:**
  - Bill-to + service location header.
  - **Itemized breakdown table** (`Item · Qty · Unit · Total`) read from `inv.line_items`, falling back to `inv.services`. Item label uses `s.name || s.title || "Item"` — same fix already in `invoicePdf.ts`.
  - Subtotal · Tax · Total · Paid summary row.
  - Payment metadata (method/date/ref) when present.
  - Notes when present.
  - **Condensed Activity Log** showing: invoice generated (from `created_at`), payment recorded (from `payment_date` + `payment_method`), invoice paid (from `paid_at`). Each line: `[Action] by [Admin Name] · [Timestamp]` — Admin name resolved by reusing the same `list-admin-users` lookup pattern as `BookingsAdmin` (via `inv.created_by` when available, else "System"). Since invoice rows don't carry per-event actor IDs, this is a derived event list, not a separate log table.
- Action footer (Download PDF, Mark Paid, Add Payment) preserved exactly as-is.

## 2. QuotesAdmin — activity log header polish + itemized parity

- **Itemized breakdown on expansion:** when a draft exists in `draftMap[q.id]`, render the same `Item · Qty · Unit · Total` table from `draft.line_items`, plus subtotal/tax/total. Show `"No quote prepared yet"` when no draft.
- **Activity Log header upgrade:** every entry currently shows just timestamp. Update the header line to `[Note] by [Admin Name] · [Timestamp]`, reusing the `adminUserMap` pattern (same query key as Bookings to share cache), driven by `n.created_by`.
- Preserve all existing buttons, draft logic, and add-on price lookup (already correct).

## 3. PDFs

`invoicePdf.ts` already reads `s.name || s.title || "Item"` (line 145) — confirmed in audit. No change needed; will note in the report.

## 4. BookingsAdmin — remove Mark as Paid button

- Remove the `Mark as Paid` button (line ~771–777).
- Replace with a small read-only pill next to the status badge:
  - `Paid` (green) when `linkedInvoice.payment_status === "paid"`
  - `Unpaid` (amber) when an invoice exists but isn't fully paid
  - Hidden when no invoice exists.
- The `Receipt Generated` indicator stays. Payments are now recorded only from `InvoicesAdmin` (single source of truth).

## 5. MessagesAdmin (Contact page) — collapsible + form details + internal Convert dialog + standard log notes

- **Convert to `CollapsibleRecordCard`** with summary: Service · Status · Date · Notes-count.
- **On expand:** show original message + a **"Submission details"** block rendering the full submission as a labelled key/value list (name, email, phone, service_type, message, status, created_at, admin_notes). Internally this is the full form payload — clean rows, not raw JSON, matching the rest of the app.
- **Replace `handleConvertToBooking` redirect with an internal dialog** `Convert Submission to Quote`:
  - Dialog fields: Name, Email, Phone (read-only prefilled), Service (select from `services` table), Description (textarea, prefilled with the message).
  - On confirm: `INSERT INTO quote_requests` with `status='requested'`, `consent_given=true`, then `UPDATE contact_submissions SET status='converted'`. Toast + invalidate `admin-quotes` and `admin-contact-messages`. No frontend redirect.
- **Standardize Activity Log notes UI** to match Bookings/Quotes: replace the inline `Input + Send` "Log Response" with the same `Textarea + Add note` pattern, rendered as a list of stamped cards using `m.admin_notes` (kept as-is — no new table). Header line: `Response by [Admin Name] · [Timestamp]` where the timestamp uses `updated_at` and admin name comes from the shared `adminUserMap`. This achieves visual parity without a schema change.

## 6. Whole-app code audit + Execution Report

Audit `BookingsAdmin`, `QuotesAdmin`, `InvoicesAdmin`, `pricingEngine.ts`, `BookService.tsx`, `RequestQuote.tsx`, and edge functions (`create-admin-user`, `delete-admin-user`, `list-admin-users`).

### Confirmed safe-to-delete (frontend only)

- `parsePrice` helper in `src/lib/quotePdf.ts` (lines ~38, ~238) — only used to re-derive add-on prices for legacy add-on rendering. Replace with the engine-snapshotted `line_items` already on the draft. Keep one tiny inline `Number()` fallback for legacy rows.
- The `fallback` chain `inv.services` reading inside InvoicesAdmin's old render — superseded by the new itemized table reading `line_items` first.
- `(b as any).total_price ?? (b as any).total_amount` short-circuit in BookingsAdmin display: prefer `total_amount`, keep `total_price` only as a last-resort fallback for very old rows.

### Must NOT delete

- The `total_price` **column** on `bookings`. The DB RPCs `create_invoice_from_booking` and `convert_quote_to_booking` (verified in `<db-functions>`) still write/read it via `COALESCE(total_amount, total_price, 0)`. Removing the column would break invoice creation and quote conversion. We will instead keep it as a **mirror** column (BookingsAdmin already writes `total_price: computed.total` alongside `total_amount`) and document it as legacy-mirror, scheduled for a future migration.
- `parsePriceStarting` in `pricingEngine.ts` — actively used to coerce string `price_starting` ("$50/hr") values from the `services` table into integers for add-ons. Single source of truth.

### Execution Report (delivered after implementation)

A bulleted summary in chat listing:
- Files modified (with one-line purpose each).
- Frontend helpers/branches removed (with line refs).
- Columns/RPCs intentionally **kept** and why.
- Confirmation that: (a) all admin cards now use `CollapsibleRecordCard`, (b) Activity Logs across Bookings/Quotes/Messages share the `[Action] by [Admin Name] · [Timestamp]` pattern, (c) Mark Paid removed from Bookings, (d) Convert opens internal dialog, (e) `pricingEngine` remains the single math source.

---

## Files Modified

- `src/pages/admin/InvoicesAdmin.tsx` — refactor to `CollapsibleRecordCard`, add itemized table + derived activity log, reuse `adminUserMap` query.
- `src/pages/admin/QuotesAdmin.tsx` — itemized breakdown on expand when draft exists, `[Note] by [Name] · [Time]` headers.
- `src/pages/admin/BookingsAdmin.tsx` — remove Mark as Paid button, add Paid/Unpaid read-only pill.
- `src/pages/admin/MessagesAdmin.tsx` — `CollapsibleRecordCard`, submission details block, internal Convert-to-Quote dialog, standardized log notes UI.
- `src/lib/quotePdf.ts` — drop `parsePrice` helper in favour of draft `line_items`.

## Files NOT Modified

- `supabase/migrations/*` — no DB changes.
- `src/lib/pricingEngine.ts` — already canonical.
- `src/lib/invoicePdf.ts` — `s.name` fix already in place.
- `src/lib/createInvoiceFromBooking.ts` — already RPC-only.
- `src/pages/BookService.tsx`, `src/pages/RequestQuote.tsx` — already routed through `computeQuote`.
- `src/integrations/supabase/{client,types}.ts` — auto-generated.
