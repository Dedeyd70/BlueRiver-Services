## Investigation findings

**Bug 1 — Pets & Square Footage not reflecting in pricing**

The pricing multipliers exist in the database and are correctly configured:
- `has_pets` / key=`true` / +$25 flat
- `square_footage` / key=`0-1000`, `1001-1500`, etc. / band-based flat amounts

However, in `src/pages/BookService.tsx` (line 270), the `pricingRequest` only passes:
```ts
{ service_type_id, service_type, condition_level, selected_addons, custom_fields: dynValues }
```

`dynValues` only contains the dynamic `service_fields` (bedrooms, bathrooms, etc.). The form-level fields `square_footage`, `has_pets`, and `pet_count` live in `form` state and are **never sent to `computeQuote`**. So `pricingEngine.readField('has_pets')` and `readField('square_footage')` both return undefined, and the multipliers never match.

**Bug 2 — Double "invoice" confusion**

Currently `Mark Completed` is enabled as soon as the booking is `confirmed`, even before any invoice/payment. Workflow needs to be: Confirm → Generate Invoice → Mark Paid (auto-creates Receipt) → Mark Completed (sends review email + archives). Right now the review email can fire before payment, and customers receive an invoice PDF and then later a receipt PDF that look duplicative.

---

## Plan

### Part 1 — Pricing fix (BookService + RequestQuote live estimate)

Update `src/pages/BookService.tsx` `computed` memo so the `pricingRequest` includes the form-level fields the multipliers key on:

```ts
const pricingRequest = {
  service_type_id, service_type, condition_level,
  selected_addons,
  square_footage: form.square_footage || null,
  has_pets: form.has_pets ? "true" : "false",
  pet_count: form.has_pets ? Number(form.pet_count) || 0 : 0,
  is_empty_property: form.is_empty_property,
  floor_type: form.floor_type || null,
  frequency: form.frequency || null,
  custom_fields: dynValues,
};
```

Add `form.square_footage, form.has_pets, form.pet_count, form.is_empty_property, form.floor_type, form.frequency` to the memo deps.

Verify `src/components/admin/DynamicQuoteSummary.tsx` does the same for admin-side recompute (read file first; patch if it has the same gap).

No engine changes needed — `pricingEngine.matchMultiplier` already supports band matches like `1501-2500` and exact-string matches for `has_pets=true`.

### Part 2 — Workflow gating in BookingsAdmin

In `src/pages/admin/BookingsAdmin.tsx`:

- Compute `const invoice = invoicesByBooking[b.id]` (already loaded elsewhere — confirm).
- Disable the **Mark Completed** button when:
  - no invoice exists for the booking, OR
  - `invoice.payment_status !== 'paid'`
- Show a tooltip: *"Generate invoice and mark it paid before completing."*
- Keep the existing handler logic (status update + review email) unchanged.
- Order the action buttons so the flow reads: Confirm → Generate Invoice → Mark Paid → Mark Completed.

This guarantees the customer gets exactly: **Invoice email → Receipt email (on payment) → Review request (on completion)** — no overlap.

### Part 3 — Admin documentation PDFs

Generate two downloadable PDFs to `/mnt/documents/`:

1. **`BlueRiver_Admin_Reference.pdf`** — comprehensive reference covering every admin tab:
   Dashboard, Submissions inbox (Quotes/Bookings/Contacts), Bookings lifecycle, Quotes & drafts, Invoices & receipts, Payments, Services & pricing rules, Pricing multipliers, Service fields, Availability & blocked dates, Gallery & before/after, Homepage CMS, Legal pages, Testimonials/Reviews, Branding, Site settings, Service areas, Social links, Team management, Permissions & roles, Notifications.

2. **`BlueRiver_Admin_Walkthrough.pdf`** — step-by-step guided walkthrough of the **end-to-end customer journey** from the admin's perspective: receiving a quote → preparing a draft → converting to booking → confirming → generating invoice → recording payment → marking completed → review captured. Includes the new gating rules from Part 2 and screenshots-style numbered steps.

Implementation: write Markdown source files to `/tmp/`, convert with `pandoc` (already available) using a clean PDF engine. Output saved to `/mnt/documents/` and surfaced via `<lov-artifact>` tags so the user can download them.

---

## Verification

- Run a manual computeQuote scenario with `square_footage=1800, has_pets=true` and confirm both line items appear in the booking summary.
- Open Bookings admin, confirm `Mark Completed` is greyed out until invoice is `paid`.
- Inspect both generated PDFs page-by-page (convert to images for QA) before delivering.