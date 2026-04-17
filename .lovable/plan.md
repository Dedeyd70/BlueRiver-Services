

# Database-Driven Itemized Pricing Engine

Refactors pricing into a structured, integer-based, DB-driven engine. Preserves existing UI shells, fields, and flows — only swaps the pricing internals and extends the admin Prepare-Quote dialog with an itemized table.

---

## 1. Database — three new tables + line-items column

**`service_types`** (new)
- `id uuid pk`, `name text unique`, `base_price integer not null default 0`
- Seeded from existing `services` (main category only) by name match

**`service_pricing_rules`** (new)
- `id uuid pk`, `service_type_id uuid → service_types(id)`, `category text` (Bedroom/Bathroom/FullBath/HalfBath/Kitchen/LivingRoom/OfficeRoom), `unit_price integer not null default 0`
- Unique `(service_type_id, category)`

**`condition_settings`** (new)
- `id uuid pk`, `name text unique` (Light/Standard/Heavy/Post-Renovation), `surcharge_amount integer not null default 0`
- Seeded: Light=0, Standard=20, Heavy=50, Post-Renovation=100

**`quote_drafts`** — add `line_items jsonb default '[]'` (keeps existing columns; `condition_multiplier`/`manual_adjustment` retained for backward-compat but no longer used by new UI)

**`invoices`** — already has `services jsonb`; reuse it for line-items in same shape.

RLS: admin-manage / public-read on the three new tables (matches existing patterns).

---

## 2. Admin → new "Pricing Settings" tab

Added under existing `SettingsAdmin.tsx` as a 4th tab — no nav restructure.

- **Service base prices** — table of service_types with integer input
- **Category rules** — per service, editable rows (Bedroom $, Bathroom $, Kitchen $, Office $, LivingRoom $)
- **Condition surcharges** — 4 fixed rows, integer inputs

All inputs `type="number" step="1" min="0"`; reject non-integer on save.

---

## 3. Pricing engine — `src/lib/pricingEngine.ts` (new)

Pure function:
```
computeQuote(request, rules, conditionSurcharge, addons, taxRate) → {
  lineItems: [{name, quantity, unit_price, total_price, type}],
  subtotal, tax, total
}
```
- Pulls base from `service_types`, multiplies room counts by matching rule unit_price
- Appends each customer-selected addon (uses parsed integer of `price_starting`)
- Appends condition surcharge as its own line item
- Integer math throughout (`Math.round`); no multipliers, no manual adjustment

---

## 4. Prepare-Quote dialog — `QuotesAdmin.tsx`

Replaces the current pricing inputs with an **Itemized Pricing Table**:

| Item | Qty | Unit Price | Total |
|---|---|---|---|
| Base Service | 1 | $X | $X |
| Bedrooms | 3 | $15 | $45 |
| Bathrooms | 2 | $25 | $50 |
| Kitchens | 1 | $30 | $30 |
| Office Rooms | … | … | … |
| Add-on: Oven | 1 | $40 | $40 |
| Condition (Heavy) | 1 | $50 | $50 |

- Auto-populated on dialog open via `computeQuote(...)` from request fields
- Each row is **editable** (qty + unit price) so admin can tweak without leaving the engine
- Totals (subtotal/tax/total) recompute live
- **Removed from UI**: condition multiplier input, manual adjustment input
- **Property Summary panel** unchanged — still shows full intake
- On Save: `line_items` JSON stored in `quote_drafts.line_items`; `base_price` mirrors base row for backward-compat

---

## 5. PDF — `src/lib/quotePdf.ts`

Pricing block rewritten to render the line_items table (Item / Qty / Unit / Total) followed by Subtotal · Tax · Total. Falls back to legacy rendering if `line_items` empty (covers older drafts).

---

## 6. Customer form — `src/pages/RequestQuote.tsx`

**No structural changes** (the dynamic service-driven form from the previous step already collects every input the engine needs: bedrooms, full/half baths, kitchens, living rooms, office rooms, condition_level, addons). No pricing exposed to customer.

---

## 7. Invoice alignment — `src/lib/createInvoiceFromBooking.ts`

When converting quote → booking → invoice, copy the quote draft's `line_items` into `invoices.services` so the invoice mirrors the quote breakdown. Invoice numbering already uses `INV-YYYY-NNNN` via DB trigger; switch prefix to `BR-` per spec.

---

## 8. Files Touched

| File | Change |
|---|---|
| **New migration** | Create `service_types`, `service_pricing_rules`, `condition_settings` (+ seed); add `line_items` to `quote_drafts`; update invoice-number trigger prefix to `BR-` |
| `src/lib/pricingEngine.ts` | NEW — pure compute function |
| `src/pages/admin/SettingsAdmin.tsx` | Add "Pricing" tab |
| `src/components/admin/PricingSettings.tsx` | NEW — three editor sections |
| `src/pages/admin/QuotesAdmin.tsx` | Swap pricing inputs for itemized editable table; remove multiplier + manual adjustment from UI |
| `src/lib/quotePdf.ts` | Render line_items table |
| `src/lib/createInvoiceFromBooking.ts` | Pass through line_items when invoice originates from a quote-linked booking |
| `src/integrations/supabase/types.ts` | Auto-regenerated |

No removed customer fields, no UI redesign of public pages, no breaking changes to existing quote/booking records (legacy fields kept, new path is additive).

