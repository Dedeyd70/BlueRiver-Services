# UI & Pagination Refinements (Phase 1A backend work paused for now)

Focused, surgical pass. No pricing/RPC work in this plan.

---

## Pre-flight: what's already done (skip)

After reading the current code:


| Asked for                                                                                | Status                                                                                             |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pb-24` on **BookingsAdmin / QuotesAdmin / MessagesAdmin / Submissions** list containers | Not yet — will add                                                                                 |
| Pagination (10/page) in BookingsAdmin                                                    | ✅ already wired with `usePagedSlice` + `Paginator` (lines 693–710)                                 |
| Pagination in MessagesAdmin                                                              | ✅ already wired (lines for active/archived)                                                        |
| Pagination in Submissions                                                                | ✅ already wired (line 214)                                                                         |
| Active/Archived tabs in QuotesAdmin                                                      | ✅ already present (lines 395–399)                                                                  |
| `?focus=` deep-link → expand + scroll/highlight in Bookings                              | ✅ already wired via `useFocusHighlight` + `expandedId` (lines 56–72, 151–161)                      |
| `?focus=` deep-link in MessagesAdmin                                                     | ✅ already wired                                                                                    |
| `mark_invoice_paid` invalidates `['admin-invoices']` and `['admin-bookings']`            | Partial — invalidates `admin-invoices` from InvoicesAdmin, but **not** `admin-bookings`. Will add. |


So the real work is narrower than the brief implies. Here's exactly what changes.

---

## 1. BackToTop z-index (1 file)

`**src/components/BackToTop.tsx**` — change `z-40` → `z-30` so it sits below the BackToTop's own dropdowns/toaster (which use `z-50`) and crucially below the bottom-of-list paginator margin guards.

---

## 2. Add `pb-24` to admin list containers (4 files)

Add bottom padding so the Paginator doesn't get visually clipped under the floating BackToTop on short viewports.

- `**BookingsAdmin.tsx**` — wrap the outer `<div>` (line 600) with `pb-24` OR add it to that div's className.
- `**QuotesAdmin.tsx**` — add `pb-24` to the outer `<div className="p-6">` (line 392).
- `**MessagesAdmin.tsx**` — add `pb-24` to `<div className="max-w-5xl mx-auto p-4">`.
- `**InvoicesAdmin.tsx**` — add `pb-24` to the root `<div>` (line 249).
- `**Submissions.tsx**` — add `pb-24` to the root `<div>` (line 135).

Single-class change per file. No layout restructure.

---

## 3. Pagination + Tabs in InvoicesAdmin (the only real refactor)

`**src/pages/admin/InvoicesAdmin.tsx**`:

a) Import `Tabs, TabsList, TabsTrigger, TabsContent` and `Paginator, PAGE_SIZE, usePagedSlice`.

b) Add state:

```ts
const [activePage, setActivePage] = useState(1);
const [archivePage, setArchivePage] = useState(1);
```

c) Derive lists (Active = not paid OR has remaining balance; Archived = paid). Cancelled bookings have no invoice, so the rule is simply `payment_status === "paid"` → archived:

```ts
const activeInvoices  = (invoices ?? []).filter(i => i.payment_status !== "paid");
const archivedInvoices = (invoices ?? []).filter(i => i.payment_status === "paid");
```

d) Replace the current single `{invoices.map(...)}` block (lines 334–409) with a `<Tabs defaultValue="active">` containing two `TabsContent` sections, each rendering `usePagedSlice(list, page).map(renderInvoiceCard)` + `<Paginator …/>`.

e) Extract the existing card JSX (lines 336–407) into a local `renderInvoiceCard(inv)` function — no visual change to the card itself.

f) **Cross-query invalidation fix** (`applyPayment.onSuccess`, line 197 + `mark_invoice_paid` flow):

```ts
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["admin-invoices"] });
  qc.invalidateQueries({ queryKey: ["admin-bookings"] });           // booking list refresh
  qc.invalidateQueries({ queryKey: ["admin-invoices-by-booking"] }); // BookingsAdmin's linked-invoice map
  qc.invalidateQueries({ queryKey: ["bookings-without-invoice"] });
  closePaymentDialog();
  toast({ title: "Payment recorded" });
},
```

Same additions on `createInvoice.onSuccess`. This is what makes a paid invoice immediately move into the Archive tab AND make the corresponding booking jump to its own Archive tab (BookingsAdmin's `isArchived` already keys off `invoiceByBooking[id].payment_status === "paid"`).

---

## 4. Card refactor — BookingsAdmin & QuotesAdmin → CollapsibleRecordCard

**Re-read of the brief vs reality:** Both pages already have `?focus=` deep-link expansion working (BookingsAdmin via `expandedId`/`setExpandedId` + `useFocusHighlight`; QuotesAdmin via `useFocusHighlight` only). The remaining ask is to **convert the row visual into the `CollapsibleRecordCard` shell** so all admin lists feel uniform with MessagesAdmin.

**BookingsAdmin** (`renderBookingCard`, lines 339–597):

- Wrap the existing details + actions in `<CollapsibleRecordCard>` with:
  - `summary` = the existing 4 fields (Date / Time / Service / Submitted)
  - `title` = `b.name`, `subtitle` = email/phone
  - `statusBadge` = current status pill
  - `expanded` = `expandedId === b.id`, `onToggle` = setExpandedId toggle
  - `innerRef` = `getRef(b.id)` (already wired)
  - `readOnly` = `isArchived(b)`
- Move everything from line 386 onward (property block, addons, totals, address, notes, cancellation reason, activity log, action buttons) into the `children` slot.
- Remove the now-redundant outer `<div>` and inline header (lines 348–384).

**QuotesAdmin** active list (lines 407–620):

- Same conversion. `summary` = Service / Contact via / Submitted (existing 3 fields, pad with one more or use 3-field grid).
- `title` = `q.name`, `subtitle` = email/phone
- `statusBadge` = status pill (+ optional "Quote prepared" chip stays inside `statusBadge` as a second pill)
- `expanded` driven by `expandedNotes === q.id` (reuse existing state — the toggle button currently lives on the activity-log button, but for the wrapper we'll add a dedicated card-level expand toggle and keep the activity-log section always visible inside `children`). To avoid double-state, **rename the existing `expandedNotes` to control card expansion** and let the activity log render unconditionally inside the expanded body.
- `innerRef` = `getRef(q.id)`
- `readOnly` = false for active, true for archived list.

Archived QuotesAdmin list (lines 627–735): same wrapping, `readOnly={true}`.

c) **Auto-expand on focus + page-jump** for QuotesAdmin (mirror BookingsAdmin pattern; this is the one place the brief is right that something is missing):

```ts
const [expandedId, setExpandedId] = useState<string | null>(null);
useEffect(() => { if (focusId) setExpandedId(focusId); }, [focusId]);
```

And add the page-jump effect (mirroring lines 151–161 of BookingsAdmin) once active/archive paginators exist. **Note:** QuotesAdmin doesn't currently have pagination — adding it now matches the other admin pages and is needed for the page-jump-on-focus to work correctly. Same `usePagedSlice` + `Paginator` pattern as BookingsAdmin.

---

## 5. Files touched (summary)


| File                                | Change                                                                                                                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/BackToTop.tsx`      | `z-40` → `z-30`                                                                                                                                                                                                                                       |
| `src/pages/admin/BookingsAdmin.tsx` | `pb-24` on root; convert `renderBookingCard` to `CollapsibleRecordCard`                                                                                                                                                                               |
| `src/pages/admin/QuotesAdmin.tsx`   | `pb-24` on root; convert active+archived cards to `CollapsibleRecordCard`; add `expandedId` + focus auto-expand; add `usePagedSlice` + `Paginator` for both tabs; page-jump-on-focus effect                                                           |
| `src/pages/admin/MessagesAdmin.tsx` | `pb-24` on root                                                                                                                                                                                                                                       |
| `src/pages/admin/InvoicesAdmin.tsx` | `pb-24` on root; Active/Archived tabs; pagination on both; extract `renderInvoiceCard`; expand `applyPayment.onSuccess` to invalidate `admin-bookings` + `admin-invoices-by-booking` + `bookings-without-invoice` (also on `createInvoice.onSuccess`) |
| `src/pages/admin/Submissions.tsx`   | `pb-24` on root                                                                                                                                                                                                                                       |


No backend, no schema, no RPC changes. The Phase 1A receipt/`mark_invoice_paid` SQL work is paused as instructed and will be picked up after this UI pass.

&nbsp;

### **1. The "Mobile" Check**

> *"Ensure the* `Paginator` *component is **centered** and responsive on mobile devices."* Sometimes, when moving from a table to a card view, the page numbers can look a bit cramped on a phone screen.

### **2. The "Focus" Highlight Color**

Since the plan implements a "Deep Link" (`?focus=`) which expands a card automatically, it's helpful if that specific card "flashes" or has a slight border color change so your eye catches it immediately. You could add:

&nbsp;

> *"When a card is focused via* `?focus=`*, give it a temporary subtle highlight border (e.g., primary color) so I can see exactly which one opened."*

---

Awaiting approval to apply these changes.