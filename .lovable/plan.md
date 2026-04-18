

# Final Cleanup — Test Data + Manual Invoice Hardening

## Scope
3 changes. No FK constraints yet.

## 1. Delete test invoices (data migration)
```sql
DELETE FROM public.invoices WHERE service_type_id IS NULL;
```
Removes the 4 legacy NULL invoices (manual entries, no `booking_id`, confirmed test data).

## 2. Harden `src/pages/admin/InvoicesAdmin.tsx`

**Form state**: add `service_type_id: string` to `InvoiceForm` (required).

**New required selector** in the Manual Invoice dialog (top of form, before customer fields):
- Fetch `service_types` via `useQuery(["service-types-for-invoice"])` ordered by name
- `<select>` with `value={form.service_type_id}` — options use `service_type.id` as value, `service_type.name` as label
- Empty default option: "Select a service…"

**Submit button**: disable when `!form.service_type_id`.

**Mutation `createInvoice`**:
- Add guard at top of `mutationFn`: `if (!form.service_type_id) throw new Error("Service type is required")`
- Include `service_type_id: form.service_type_id` in the `.insert({...})` payload
- Look up matching `service_type.name` and also store as `service_type` snapshot if column added later (skip — invoices table has no `service_type` text column, only `service_type_id`)

## 3. Verification (post-run)
- `SELECT count(*) FROM invoices WHERE service_type_id IS NULL` → expect **0**
- New manual invoice cannot be submitted without selecting a service
- Auto-generated invoices (from booking completion) continue to set `service_type_id` from `booking.service_type_id`

## What stays untouched
- No FK constraints
- Pricing engine, booking flow, quote flow — no logic change
- `createInvoiceFromBooking.ts` — already correct from prior step
- UI styling/layout — only adds one required `<select>` to existing dialog

## Files Touched

| File | Change |
|---|---|
| New migration | `DELETE FROM invoices WHERE service_type_id IS NULL` |
| `src/pages/admin/InvoicesAdmin.tsx` | Add required service selector, validation, include `service_type_id` in insert |

## Post-task state
- `invoices.service_type_id`: 100% populated (10/10 remaining rows)
- All 4 history tables fully ID-covered
- Manual invoice path enforces ID at form + mutation level
- System ready for nullable FK enforcement in next step

