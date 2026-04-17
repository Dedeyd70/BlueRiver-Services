

# Two-Layer Quote Model: Customer Form + Admin Builder

Preserves all existing fields and UI. Only **adds** the missing pieces and **extends** the admin Prepare-Quote dialog with structured pricing inputs.

---

## 1. Database — additive only

**`quote_requests`** — add columns (none removed):
- `kitchen_count integer` (nullable) — kitchen yes/no or count
- `condition_level text` (nullable) — `'light' | 'standard' | 'heavy'`

**`quote_drafts`** — add columns (none removed):
- `condition_multiplier numeric default 1` — applied to base price
- `manual_adjustment numeric default 0` — admin override
- `breakdown jsonb default '{}'` — snapshot of room/condition/addons used to compute total (audit trail)

No existing column is renamed or dropped. No status changes.

---

## 2. Customer form — `src/pages/RequestQuote.tsx`

**Keep everything currently there.** Add only the two missing fields:

- **Kitchen** — number input (0–10) labelled "Kitchens" placed next to Bedrooms/Bathrooms grid.
- **Condition Level** — select with options `Light`, `Standard`, `Heavy`, placed near Frequency.

**Confirm absent (already true):** no price display, no totals, no calculator. The form remains pure data collection.

Submit payload extended with `kitchen_count` and `condition_level`. All other fields (property_type, sq ft, bedrooms, bathrooms, frequency, pets, entry codes, addons, description, attachment) stay exactly as-is.

---

## 3. Admin Quote Builder — `src/pages/admin/QuotesAdmin.tsx`

The existing **Prepare Quote** dialog gets a new read-only "Property Summary" panel above the pricing inputs and an extended pricing section.

### New "Property Summary" panel (read-only)
Renders from the original `quote_requests` row:
- Service type · Property type · Sq ft
- Bedrooms · Bathrooms · **Kitchens** · Pets
- **Condition level** (badge: Light/Standard/Heavy)
- Frequency · Entry codes
- Customer-selected add-ons (chips)
- Description (collapsed, expandable)

This panel is purely informational — admin sees the full intake at a glance.

### Extended pricing inputs (additive to current draft form)
Existing fields remain: base price, addons list, discount, tax_rate, notes, validity_days. **Add:**

- **Condition multiplier** — auto-suggested from `condition_level` (Light = 0.9, Standard = 1.0, Heavy = 1.3) but editable.
- **Manual adjustment** — signed numeric override (+/−) applied after multiplier.
- **Live breakdown card** showing:
  ```
  Base                       $X
  × Condition (1.3 Heavy)    $Y
  + Add-ons                  $Z
  + Manual adjustment        $A
  − Discount                 $D
  Subtotal                   $S
  Tax (n%)                   $T
  ─────────────────────────
  Total                      $TOTAL
  ```

On Save, the computed `breakdown` JSON is stored alongside the draft so the PDF and any later audit reflect the exact composition.

### PDF generation — `src/lib/quotePdf.ts`
Pricing section extended to render the same breakdown shown in the dialog (base, condition multiplier line, addons, manual adjustment, discount, subtotal, tax, total). No template restructuring — only the Pricing block gains rows.

---

## 4. Consistency rule

Because the customer form already uses one shared schema (`quote_requests`) regardless of selected service, no service-specific branching is introduced. The two new fields apply uniformly to every service type. Admin builder reads the same fields for every quote.

---

## 5. Files Touched

| File | Change |
|---|---|
| **New migration** | Add `kitchen_count`, `condition_level` to `quote_requests`; add `condition_multiplier`, `manual_adjustment`, `breakdown` to `quote_drafts` |
| `src/pages/RequestQuote.tsx` | Add Kitchen number + Condition Level select; include in insert payload |
| `src/pages/admin/QuotesAdmin.tsx` | Add Property Summary panel + condition multiplier + manual adjustment inputs + live breakdown in Prepare Quote dialog |
| `src/lib/quotePdf.ts` | Render condition multiplier and manual adjustment rows in pricing block |
| `src/integrations/supabase/types.ts` | Auto-regenerated to reflect new columns |

No UI redesign, no removed fields, no schema renames, no service-specific forms.

