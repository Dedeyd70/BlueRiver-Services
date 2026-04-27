# Forensic Audit — Quote/Booking/Invoice/Receipt Flow

This is what is **actually happening in production right now**, based on live DB rows, RPC source, and frontend code.

---

## A. SYSTEM FLOW MAP (REAL EXECUTION)

| # | Step | Trigger | File / Function | RPC or DB | Idempotent | Safe-Mode? |
|---|------|---------|-----------------|-----------|------------|------------|
| 1 | Quote request | Public form submit | `RequestQuote.tsx` → `quote_requests.insert` | Direct DB | No | OK (read-only data) |
| 2 | Quote prepare | Admin opens "Prepare" | `QuotesAdmin.tsx` → `quote_drafts.upsert` | Direct DB (upsert, NOT RPC) | Yes (onConflict quote_id) | OK |
| 3 | Quote → Booking | Admin "Convert" dialog | `QuotesAdmin.tsx::convertToBooking` → `rpc('convert_quote_to_booking')` + follow-up `bookings.update` | RPC + DB patch | Yes (RPC reuses existing booking) | Mostly — see issues |
| 4 | Booking → Invoice | "Mark Completed" or "Generate Invoice" | `BookingsAdmin.tsx::handleCompleted` / `handleGenerateInvoice` → `createInvoiceFromBooking` → `rpc('create_invoice_from_booking')` | RPC | Yes (RPC reuses existing invoice) | **BROKEN** — RPC throws (see G) |
| 5 | Payment | "Mark as Paid" or partial in `InvoicesAdmin` | `rpc('mark_invoice_paid')` (full) **or** direct `invoices.update` (partial) | Mixed | Yes for full; not idempotent for partial | **BROKEN** for full — RPC throws |
| 6 | Receipt | Auto inside `mark_invoice_paid` → calls `create_receipt(p_invoice_id)` | RPC chain | Yes (reuses existing receipt) | OK in theory; never reached because step 5 fails |

---

## B. UI BUTTON LOGIC — `BookingsAdmin.tsx` lines 426–497

Every button lives inside a single IIFE that resolves three flags:
```ts
const linkedInvoice  = invoiceByBooking?.[b.id];        // from query "admin-invoices-by-booking"
const isQuoteSourced = b.source === "quote" || !!b.quote_id;
const showLifecycle  = !isCompleted && !isCancelled;
```

| Button | Render condition | Required data | Action | Currently working? |
|--------|------------------|---------------|--------|---------------------|
| **Confirm** | `showLifecycle && b.status==="pending"` | — | `bookings.update {status:"confirmed"}` | OK |
| **Mark Completed** | `showLifecycle && b.status==="confirmed"` | — | update + `createInvoiceFromBooking` | **Update succeeds but invoice creation throws** |
| **Generate Invoice** | `!linkedInvoice && !isQuoteSourced` | `b.source !== "quote"` AND `b.quote_id` is null | `rpc('create_invoice_from_booking')` | **NEVER renders for current rows** — every booking in DB has `source='quote'` |
| **View Invoice** | `linkedInvoice` present | invoice row with `booking_id = b.id` | open PDF | Renders only if invoice exists; most don't |
| **Send Invoice** | `linkedInvoice` present | same | `mailto:` | same |
| **Mark as Paid** | `linkedInvoice && payment_status !== "paid"` | invoice exists | `rpc('mark_invoice_paid')` | **Throws** (see G) |
| **Receipt Generated** (disabled label) | `linkedInvoice && payment_status === "paid"` | — | none | shows for the 1 row that is `paid` |

---

## C. WHY BUTTONS ARE NOT SHOWING

### 1. "Generate Invoice" — never visible
- Condition: `!linkedInvoice && !isQuoteSourced`.
- Live data: **6/6 most-recent bookings have `source='quote'`**, even the ones created from the public booking form. Reason: `bookings.source` defaults to `'quote'` at the DB level (`source text DEFAULT 'quote'`). `BookService.tsx` does set `source:"manual"` (line 300) — so new public manual bookings will be correct, but every historical row is `quote` and the UI hides the button.
- Verdict: **frontend logic correct, but data layer default makes the gate fail for all legacy rows.**

### 2. "View / Send / Mark Paid" — missing on most bookings
- Gate: `linkedInvoice` truthy.
- Live data: only **2 invoices exist** (`BR-2026-0018`, `BR-2026-0019`). Of those, one has `booking_id = NULL`. So only 1 booking has a linked invoice.
- Root cause: invoices stopped being created. The RPC is failing — see G #1.

### 3. "Mark as Paid" — appears but errors when clicked
- Postgres log (last error): `ERROR: column "status" does not exist`. From `mark_invoice_paid`. See G #2.

---

## D. DATA FLOW VALIDATION

**Quote → Booking**
- `source` is **wrong**. RPC `convert_quote_to_booking` does NOT set `source`. The frontend follow-up patches it to `"quote"` (`QuotesAdmin.tsx:339`). ✅ correct intent.
- `BUT`: bookings created by `BookService.tsx` *should* be `manual`. The insert sets it (line 300), but if any earlier code path or default ran first, the row stays `quote`. Live data confirms ALL recent rows are `quote`.
- `quote_id`: correctly linked when RPC runs. Confirmed in DB (4/6 rows have a `quote_id`).

**Booking → Invoice**
- `invoice.booking_id` is set by the RPC. Live data: **1 invoice with booking_id, 1 invoice with NULL** (orphan). Orphan's booking_id is null because… see next.
- Invoices are routed exclusively through `create_invoice_from_booking` in current code — but most calls are silently failing. Only 2 invoices exist for 6+ bookings.

**Invoice → Receipt**
- `receipts` table is **completely empty** (`SELECT * FROM receipts → []`).
- One invoice has `payment_status='paid'` but `paid_at IS NULL` and no receipt exists. That proves `mark_invoice_paid` **never successfully ran** for it (status was set by an older direct UPDATE path that no longer exists).

---

## E. RPC USAGE AUDIT

### `convert_quote_to_booking(p_quote_id)`
- Used: ✅ `QuotesAdmin.tsx:291`.
- Bypassed: No.
- Returns: full booking row jsonb — frontend reads `.id` correctly.
- **Issue**: RPC inserts only `id, quote_id, service_type_id, line_items, total_price, created_at`. Does NOT set `source`, `subtotal`, `tax_amount`, `total_amount`. The frontend then `UPDATE`s with `source:"quote"` and other fields — works but is two round-trips.

### `create_invoice_from_booking(p_booking_id)` — **BROKEN**
- Used: ✅ via `createInvoiceFromBooking.ts`.
- Returns: should return jsonb of invoice row.
- **Bug**: function body inserts into column `status` (`'draft'`), but the `invoices` table **has no `status` column** (verified via `information_schema.columns`). Every call raises:
  `ERROR: column "status" of relation "invoices" does not exist`.
- This is why "Mark Completed" toasts an error and no invoice is created.

### `mark_invoice_paid(p_invoice_id)` — **BROKEN**
- Used: ✅ `BookingsAdmin.tsx:253` and `InvoicesAdmin.tsx:177`.
- **Bug**: function body sets `status='paid'` AND `payment_status='paid'`. Same missing column → throws `column "status" does not exist` (confirmed in postgres logs at 2026-04-27 07:36:33).
- Side effect: receipt never gets created (the `PERFORM create_receipt(...)` line is never reached).

---

## F. FRONTEND vs DATABASE MISMATCHES

| Item | Frontend expects | DB reality | Impact |
|------|------------------|------------|--------|
| `invoices.status` | RPC writes it | Column doesn't exist | RPCs throw |
| `invoices.tax`, `total` | RPC writes both `tax`/`tax_amount` and `total`/`total_amount` | Both pairs exist (legacy duplication) | Works, but UI reads only `total_amount`, `tax_amount`. `total` and `tax` stay NULL on new rows from the RPC's `COALESCE` path. |
| `bookings.source` | Frontend gates on `'manual'` vs `'quote'` | Column default is `'quote'` for everything | Public bookings that don't explicitly set `source` end up as `quote` and hide "Generate Invoice" |
| `invoices.line_items` vs `services` | RPC populates BOTH from booking.line_items | Both columns exist; `services` is `NOT NULL` so RPC must set it (it does) | OK |
| `receipts.line_items` | DB column exists, default `[]` | `create_receipt` does NOT populate it | Receipt rows would be created with empty line items (low-priority) |
| `InvoicesAdmin` partial payment | Direct `invoices.update` (line 169-180) sets `payment_status` and `amount_paid` | Bypasses RPC | Violates Safe-Mode "RPC owns business logic" — duplicated payment logic |

---

## G. ROOT CAUSE SUMMARY (TOP 5)

| # | File / Function | Exact problem |
|---|-----------------|---------------|
| 1 | `public.create_invoice_from_booking` (DB function) | Inserts into nonexistent column `status` (value `'draft'`). Every call fails → no invoices get created → no `linkedInvoice` → `View/Send/Mark Paid` buttons never render. |
| 2 | `public.mark_invoice_paid` (DB function) | Sets nonexistent column `status='paid'`. Throws → invoice never marked paid via RPC → `create_receipt` never invoked → `receipts` table stays empty. |
| 3 | `bookings.source` DB default = `'quote'` + missing source on RPC-created rows | `convert_quote_to_booking` doesn't set `source`; frontend patches it but to `'quote'` regardless. Result: every row is `'quote'`, so `BookingsAdmin.tsx:459` (`!isQuoteSourced`) hides "Generate Invoice" universally. |
| 4 | `BookingsAdmin.tsx:472–476` "Mark as Paid" gate | Renders fine, but click triggers RPC #2 which throws. UX shows red toast, paid_at stays NULL, receipt never made. |
| 5 | `InvoicesAdmin.tsx:153–185` partial-payment path | Bypasses RPC entirely (`supabase.from('invoices').update(...)`). Inconsistent with Safe-Mode rule. Also sets `payment_status='paid'` directly when `newPaid >= total`, then calls broken RPC — leaves data half-written. |

---

## H. FIX PLAN (TARGETED)

These are the precise corrections. **All but #5 require database changes** (the user's earlier instruction "frontend only" is impossible to honor here because the live RPCs reference a column that doesn't exist — that's a DB-side bug). I'll surface this clearly before touching anything.

### DB FIXES (mandatory — can't be worked around in frontend)

1. **Patch `create_invoice_from_booking`** — remove `status` from the INSERT column list and the `'draft'` literal from the VALUES list. Leave everything else identical. Idempotency and `invoice_number` trigger remain untouched.
2. **Patch `mark_invoice_paid`** — remove `status = 'paid',` from the UPDATE SET clause. Keep `payment_status='paid'` and `paid_at=now()`. The receipt auto-creation line stays.
3. **Patch `convert_quote_to_booking`** — add `source` to the INSERT column list with value `'quote'` so the booking is correctly tagged at creation (defense in depth; frontend patch becomes redundant but harmless).

### DATA FIX (one-shot)

4. Backfill: `UPDATE bookings SET source='manual' WHERE quote_id IS NULL AND source='quote';` — corrects the legacy rows so "Generate Invoice" appears on the 2 manual bookings (`denii`, `grnama`) that currently have no quote link.

### FRONTEND FIXES

5. **`InvoicesAdmin.tsx::applyPayment`** (lines 152–186) — when `isFullyPaid`, do NOT pre-write `payment_status='paid'`. Write only the running `amount_paid` + payment metadata, then call `rpc('mark_invoice_paid')` and let the RPC own the status flip + receipt. Removes duplicated business logic.
6. **`BookingsAdmin.tsx`** — after `handleMarkPaid` succeeds, also invalidate `["receipts"]` query (currently never refetched) so a future "View Receipt" button can rely on it.

### NOT CHANGED (intentionally)

- `set_invoice_number` trigger — already the single source of truth for invoice numbers. ✅
- `generate_receipt_number` — same for receipts. ✅
- RLS policies — all current policies allow the actions; failures are logic, not auth.
- `BookService.tsx` `source:"manual"` — already correct.

---

## Decision needed before implementation

The user previously instructed "frontend only — do not modify DB". The forensic evidence shows the DB functions reference a nonexistent column and **cannot** be fixed from the frontend. I will need approval to apply the three small DB function patches (#1–#3) and the one-line backfill (#4) alongside the two frontend tweaks (#5–#6).

If approval is withheld for DB changes, the only frontend-only mitigation would be to stop calling the broken RPCs and revert to direct inserts/updates — which directly violates Safe-Mode and the earlier "RPC owns business logic" directive. Recommend approving the DB patches.