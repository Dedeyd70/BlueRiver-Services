

# Service-Driven Dynamic Quote Form

Extends the existing `RequestQuote.tsx` form with **service-conditional field groups** and adds the missing structured fields. All current fields, validation, upload logic, and admin views are preserved — we only add new fields and conditional grouping.

---

## 1. Database — additive only

Add columns to `quote_requests` (none removed):

| Column | Type | Purpose |
|---|---|---|
| `full_bathrooms` | integer | Split from generic bathrooms |
| `half_bathrooms` | integer | Split from generic bathrooms |
| `living_rooms` | integer | Living rooms / halls count |
| `office_rooms` | integer | Commercial: office sections |
| `floor_type` | text | Commercial: carpet/tile/mixed |
| `property_size` | text | Commercial: small/medium/large |
| `has_cabinets` | boolean | Move-in/out: cabinets included |
| `is_empty_property` | boolean | Move-in/out: empty toggle |

Existing `bedrooms`, `bathrooms`, `kitchen_count`, `condition_level`, `frequency`, `selected_addons`, `property_type`, `square_footage`, `has_pets`, `entry_codes` all remain unchanged for backward compatibility.

---

## 2. Customer Form — `src/pages/RequestQuote.tsx`

### Reorder: Service Type moves to the top
Service Type select is repositioned **above** property details so the form becomes service-driven. Contact fields (name/email/phone/address) stay where they are.

### Conditional field groups (rendered only after service selected)

Each group is wrapped in a labeled section card. Logic uses simple service-name matching (case-insensitive contains) against existing service titles:

| Service match | Group rendered |
|---|---|
| "residential" / "regular" / "standard" | **Residential**: bedrooms, full baths, half baths, living rooms, kitchens, condition, addons |
| "deep" | **Deep Cleaning**: bedrooms, full baths, half baths, kitchens (highlighted), living rooms, condition (required emphasis), addons |
| "commercial" / "office" | **Commercial**: bathrooms, office rooms, floor type select, property size select, frequency |
| "move" | **Move In/Out**: bedrooms, bathrooms, kitchens, cabinets toggle, empty property toggle, condition (default heavy), addons |
| "recurring" / "weekly" / "monthly" / "bi-weekly" | **Recurring**: bedrooms, bathrooms, kitchens, frequency, condition (maintenance) |
| any other / unmatched | Falls back to current generic layout |

**Preserved as-is:** name, email, phone, address, preferred_contact, property_type, square_footage, has_pets, entry_codes, description, attachment upload, consent checkbox, rate-limit, validation, submit handler structure.

Submit payload extended with the new fields (all nullable).

---

## 3. Admin Quote Builder — `src/pages/admin/QuotesAdmin.tsx`

The existing **Property Summary** panel in the Prepare Quote dialog gains the new fields. No layout overhaul — just additional rows/chips conditional on which fields are populated:

- Bathrooms displays as `Full: X · Half: Y` when split values exist, else falls back to generic `bathrooms`
- Living rooms / Office rooms shown when present
- Floor type, property size, cabinets, empty property shown when present
- Service type displayed at top (already present)

Pricing logic, condition multiplier, manual adjustment, breakdown card — all unchanged.

---

## 4. PDF — no change required

`quotePdf.ts` reads from the admin `quote_drafts`, not from the raw request, so no PDF changes are needed for this iteration.

---

## 5. Files Touched

| File | Change |
|---|---|
| **New migration** | Add 8 nullable columns to `quote_requests` |
| `src/pages/RequestQuote.tsx` | Reorder Service Type to top; add `renderServiceFields()` switch with grouped sections; extend insert payload |
| `src/pages/admin/QuotesAdmin.tsx` | Property Summary panel renders new fields when present |
| `src/integrations/supabase/types.ts` | Auto-regenerated |

No removed fields, no UI redesign, no breaking schema changes.

