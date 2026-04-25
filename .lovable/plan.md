# Phase 2 Final — Idempotency, Unified Payments, Branded Invoice PDF

Strict guardrails: no schema changes, no new tables, no parallel flows, no UI redesign. Every change extends an existing function or wraps an existing button.

---

## Part 1 — Idempotency guards (1 quote → 1 booking → 1 invoice)

**File: `src/pages/admin/QuotesAdmin.tsx`** — `convertToBooking` mutation (line 250)

At the **top** of `mutationFn`, before the insert, add a pre-check:

```ts
const { data: existing } = await supabase
  .from("bookings")
  .select("id")
  .eq("quote_id", selectedQuote.id)
  .maybeSingle();
if (existing) {
  throw new Error("A booking already exists for this quote.");
}
```

No new table, no new path — just a guard that prevents the duplicate insert and surfaces a toast via the existing `onError` handler.

**File: `src/lib/createInvoiceFromBooking.ts`** — `createInvoiceFromBooking` function

At the **top** of the function, before any work, add:

```ts
const { data: existingInvoice } = await supabase
  .from("invoices")
  .select("*")
  .eq("booking_id", booking.id)
  .maybeSingle();
if (existingInvoice) return existingInvoice;
```

This way the existing `handleCompleted` flow in `BookingsAdmin.tsx` keeps working — it just receives the already-created invoice on a second click instead of inserting a duplicate. No call site changes required.

---

## Part 2 — Unified PaymentDialog (replaces markPaid + recordPayment)

**File: `src/pages/admin/InvoicesAdmin.tsx`** only — single source of truth.

### Component (defined inline in the same file, no new file)

`<PaymentDialog invoice mode="full"|"partial" open onOpenChange />`

Fields:
- **Method** — `<select>` with: Cash, Check, Bank Transfer, Square, Zelle, Other (controlled list)
- **Date Received** — date input, default today
- **Reference #** — optional text
- **Amount** — only rendered when `mode === "partial"`, defaults to remaining balance

### Single mutation replaces both old ones

Delete `markPaid` (lines 169–183) and the inline-input variant of `recordPayment` (lines 148–167). Replace with one mutation `applyPayment`:

```ts
const applyPayment = useMutation({
  mutationFn: async ({ id, amount, method, date, reference }) => {
    const inv = invoices?.find(i => i.id === id);
    if (!inv) throw new Error("Invoice not found");
    const newPaid = Number(inv.amount_paid) + amount;
    const newStatus = newPaid >= Number(inv.total_amount) ? "paid"
                    : newPaid > 0 ? "partial" : "unpaid";
    const { error } = await supabase.from("invoices").update({
      amount_paid: newPaid,
      payment_status: newStatus,
      payment_method: method,
      payment_date: date,
      payment_reference: reference || null,
    }).eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-invoices"] }); ... },
});
```

### Buttons on each invoice card

- **Mark Paid** → opens PaymentDialog in `mode="full"`, hides Amount, on submit passes `amount = total_amount - amount_paid`
- **Add Payment** → opens PaymentDialog in `mode="partial"`, shows Amount

Both buttons go through the same dialog and the same mutation. No other payment paths exist anywhere else in the app (already verified — `markPaid`/`recordPayment` only appear in `InvoicesAdmin.tsx`).

### Manual Invoice creation form

Replace the free-text **Payment Method** `<Input>` (line 250) with the same controlled `<select>` (Cash/Check/Bank Transfer/Square/Zelle/Other). No other form fields change.

### Card display

When `payment_status !== 'unpaid'`, surface `Method · Date Received · Reference #` as one extra muted line under the existing Method line. Card layout unchanged otherwise.

---

## Part 3 — Branded invoice PDF (new file `src/lib/invoicePdf.ts`)

Mirrors `quotePdf.ts` exactly — same margins, fonts, header, divider, two-column "Bill to / Service location", itemized table columns (Item / Qty / Unit / Total), totals stack. **No helper duplication** — both files independently call `jsPDF` primitives the same way; we don't extract shared code (per "do not duplicate" — there's nothing currently shared to break).

### What's different from the quote PDF

- Header label: `INVOICE  #<invoice_number>` instead of `QUOTE  #...`
- Right-side meta: `Issued: …` and `Due: …`
- Totals stack adds **Paid** and **Balance Due** lines
- When any payment exists: extra block printing **Method**, **Date Received**, **Reference #**
- When `payment_status === "paid"`: **PAID watermark**

### PAID watermark implementation

```ts
if (inv.payment_status === "paid") {
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.12 }));
  doc.setTextColor(40, 130, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(110);
  doc.text("PAID", pageW / 2, doc.internal.pageSize.getHeight() / 2,
           { align: "center", angle: 30 });
  doc.restoreGraphicsState();
}
```

Drawn **after** all content so it sits on top with low opacity but doesn't push layout. Skipped for `unpaid` and `partial`.

### Source of truth

The PDF reads **only** from the persisted `invoices` row — `services` (line items snapshot), `subtotal`, `tax_rate`, `tax_amount`, `total_amount`, `amount_paid`, `payment_*` columns. **No recalculation, no joining back to drafts.** This matches Part 7 of your rules — invoices are stable records.

### Wire-up

`InvoicesAdmin.tsx` imports `generateInvoicePdf` from `@/lib/invoicePdf` and replaces the inline `generateInvoicePDF` (lines 46–82). It fetches `branding_settings` and `site_settings` via the same `useQuery` pattern already used in `QuotesAdmin.tsx`. The inline 37-line function is deleted.

---

## Part 4 — Permission gating with existing `<HasPermission />`

Wrap **only mutating** action buttons. Read-only (Download PDF, expand details) stay open.

| File | Buttons wrapped | Permission |
|---|---|---|
| `QuotesAdmin.tsx` | Mark In Progress, Prepare/Edit Quote, Send Quote, Convert to Booking, Close | `can_manage_quotes` |
| `BookingsAdmin.tsx` | Confirm, Mark Completed, Cancel | `can_manage_bookings` |
| `InvoicesAdmin.tsx` | Manual Invoice trigger, Mark Paid, Add Payment | `can_manage_bookings` |
| `MessagesAdmin.tsx` | Mark Read, Convert, Log Response | `can_manage_messages` |

`<HasPermission>` short-circuits to `true` for `role === "admin"` (already implemented in `useHasPermission`), so admins lose nothing. No layout change — wrapping is invisible when permission is granted.

---

## Part 5 — Focus polish + invoice support

**File: `src/hooks/useFocusHighlight.tsx`** — strengthen highlight only:

Replace ring class set with: `ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/30` and bump the timeout from `3000` to `4000`. **Hook API unchanged**, all four pages keep working.

**File: `src/pages/admin/InvoicesAdmin.tsx`** — add `?focus=` support:

- `const { getRef } = useFocusHighlight(!isLoading && !!invoices);`
- Add `ref={getRef(inv.id)}` and `scroll-mt-24` to each invoice card div.

The bell route `invoice → /admin/invoices?focus=<id>` was added in Phase 1, so no `NotificationBell.tsx` change is needed.

---

## Files touched (final list)

| File | Change |
|---|---|
| `src/pages/admin/QuotesAdmin.tsx` | Add idempotency guard at top of `convertToBooking`; wrap mutating buttons in `<HasPermission permission="can_manage_quotes">` |
| `src/lib/createInvoiceFromBooking.ts` | Add idempotent early-return when invoice exists for `booking_id` |
| `src/pages/admin/InvoicesAdmin.tsx` | Replace `markPaid` + `recordPayment` with single `applyPayment` mutation + inline `PaymentDialog`; constrain Manual-Invoice method to select; swap inline PDF for `invoicePdf.ts`; wrap mutating buttons with `<HasPermission permission="can_manage_bookings">`; add `?focus=` plumbing |
| `src/lib/invoicePdf.ts` | **New** — branded invoice PDF mirroring `quotePdf.ts` layout; PAID watermark when paid; reads only from `invoices` row |
| `src/pages/admin/BookingsAdmin.tsx` | Wrap Confirm / Mark Completed / Cancel with `<HasPermission permission="can_manage_bookings">` |
| `src/pages/admin/MessagesAdmin.tsx` | Wrap Mark Read / Convert / Log Response with `<HasPermission permission="can_manage_messages">` |
| `src/hooks/useFocusHighlight.tsx` | Stronger ring + shadow, 4 s duration; **API unchanged** |

## What is **not** touched

- ❌ No DB migration, no new columns, no new tables — Phase 1 schema is sufficient (`payment_date`, `payment_reference` exist; `booking_activity_logs` exists)
- ❌ No RLS / FK / constraint changes
- ❌ No new triggers
- ❌ `quotePdf.ts` untouched
- ❌ `pricingEngine.ts` untouched — invoices never recalculate, only display persisted totals
- ❌ `NotificationBell.tsx` untouched — `invoice` mapping already in place
- ❌ Public booking / public quote forms untouched
- ❌ Existing booking insert RLS path for anonymous users unaffected

## Final safety checklist that this plan satisfies

| Rule | How |
|---|---|
| 1 quote → 1 booking | guard in `convertToBooking` |
| 1 booking → 1 invoice | guard in `createInvoiceFromBooking` (returns existing) |
| One payment system | single `applyPayment` mutation + single `PaymentDialog`; old mutations deleted |
| No new payment tables/APIs | reuses `invoices` columns added in Phase 1 |
| Invoice uses persisted totals | PDF reads only from `invoices` row |
| Permissions only on mutations | read-only buttons (Download PDF, view) stay visible |
| Watermark only when paid | guard `if (inv.payment_status === "paid")` |
| Focus hook API unchanged | only class + duration change |
| Public booking still works | `bookings` insert RLS untouched, no new required columns |

Ready to implement on approval.