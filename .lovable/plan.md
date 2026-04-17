

## What exists vs what I will change

### Already working (won't touch)
- `service_fields` table with `field_key`, `label`, `input_type`, `required`, `display_order` ✅
- `service_pricing_rules` with `service_type_id` + `category` (= field_key) + `unit_price` ✅
- Per-service field CRUD + auto-creation of matching pricing rule for `number` fields ✅
- `condition_settings` surcharge system (separate, applied after subtotal) ✅
- Pricing engine, Prepare Quote dialog, PDF, customer form ✅

### The gaps causing the user's complaints
1. **All services show all fields stacked** — current UI lists every service in a single scroll, no way to focus on one. User wants a dropdown.
2. **"no price" placeholder** appears for non-number fields (select/toggle), and for number fields whose pricing rule didn't get created (legacy data before auto-create existed).
3. **No way to attach a price to existing fields without a rule** — if a rule is missing, the row just shows "no price" with no action.
4. **Edit field metadata** (label / required / input_type) not currently possible — only add + delete.

---

## Targeted changes (UI-only inside `PricingSettings.tsx`)

### 1. Add Service Selector at top of "Service Fields & Pricing" section
Replace the "render every service card stacked" loop with:
- A `<Select>` dropdown labeled **"Select Service Type"** populated from `service_types`
- Auto-select the first service on mount
- Render only the selected service's `ServiceFieldEditor` below it

### 2. Auto-heal missing pricing rules
When the selected service loads its fields:
- For every `number` field that has **no matching `service_pricing_rules` row**, silently insert one with `unit_price: 0` (one-time per render, idempotent via the existing unique pattern)
- Result: every number field always has an editable `$` input — no more "no price" for number fields

### 3. Replace "no price" text for non-number fields
Instead of italic "no price", show a small muted badge:
- `select` / `toggle` fields → `"not priced"` badge (these legitimately don't carry per-unit price; they affect form UI only)
- This is honest labeling, not a placeholder

### 4. Add inline "Edit field" capability
Add a pencil icon next to each field row that opens the same dialog used for "Add Field" pre-filled with current values. Submitting updates `service_fields` row (label, input_type, required, options). `field_key` stays immutable to preserve the link to `service_pricing_rules.category`.

### 5. Empty-state guidance
When a service has zero fields → show a friendly empty state with a single "Add your first field" button (already implicit, just polish the copy).

---

## What stays exactly as-is
- Base Prices section — untouched
- Condition Surcharges section — untouched
- Customer quote form — untouched
- Prepare Quote dialog / itemized table — untouched
- PDF, invoices, bookings, notifications — untouched
- DB schema — no migrations needed
- Pricing engine logic — unchanged

---

## Files touched (one file)

| File | Change |
|---|---|
| `src/components/admin/PricingSettings.tsx` | Add service selector, auto-heal missing pricing rules for number fields, swap "no price" copy, add edit-field dialog |

No new tables. No data migration. No removed UI. No touched flows outside the Pricing tab.

