
# Phase 1 — Pricing Sync (DB rename, UI sync, Booking → engine handshake)

Strictly aligned to the audit. No new tables. No UI redesign. No invoice/receipt RPC changes (still paused for Phase 1A).

---

## 1. Database standardization

### 1a. Rename `condition_settings`
Data update (insert tool):
```sql
UPDATE condition_settings SET name = 'Post-Construction' WHERE name = 'Post-Renovation';
```
No existing `bookings` or `quote_requests` rows reference `'Post-Renovation'` (verified: 0 rows). UI already sends `'Post-Construction'`, so the surcharge starts applying immediately.

### 1b. Rename `Reccuring Cleaning` → `Recurring Cleaning`
Two name-keyed tables plus historical rows that use the old name as a fallback matcher in `pricingEngine.computeQuote` (matches by `service_type` text when `service_type_id` is null). Verified counts: 2 bookings, 3 quote_requests still reference the typo.

Single insert-tool transaction:
```sql
UPDATE service_types SET name = 'Recurring Cleaning' WHERE name = 'Reccuring Cleaning';
UPDATE services      SET title = 'Recurring Cleaning' WHERE title = 'Reccuring Cleaning';
UPDATE bookings        SET service_type = 'Recurring Cleaning' WHERE service_type = 'Reccuring Cleaning';
UPDATE quote_requests  SET service_type = 'Recurring Cleaning' WHERE service_type = 'Reccuring Cleaning';
```
`service_pricing_rules` and `service_fields` link by `service_type_id` (uuid), so they need no update.

### 1c. Delete dead capitalized rules
35 rows confirmed. Insert tool:
```sql
DELETE FROM service_pricing_rules
 WHERE category IN ('Bedroom','Bathroom','FullBath','HalfBath','Kitchen','LivingRoom','OfficeRoom')
   AND unit_price = 0;
```
`pricingEngine.ts` resolves rules by strict `category === field_key` (snake_case), so these rows are unreachable today — safe to drop. The legacy `category` comment in `pricingEngine.ts` (L20) gets a one-line cleanup to reflect snake_case-only.

---

## 2. UI condition dropdown sync

Add `Light` option (mirrors DB), keep order: `Light, Standard, Heavy, Post-Construction`.

- `src/pages/BookService.tsx` L432–437 — add `<option value="Light">Light</option>` as the first option.
- `src/pages/RequestQuote.tsx` L344–348 — same change, identical wording and order.

No state, validation, or schema change. Both forms stay byte-identical to each other for these options.

---

## 3. BookService → pricingEngine handshake

Goal: the form's "Estimated Total" and the row written to `bookings` must come from the same authoritative engine the admin uses. Stop writing legacy `total_price`; populate `line_items / subtotal / tax_amount / total_amount` instead.

### 3a. Load engine inputs in `BookService.tsx`
Add three react-query hooks alongside existing `serviceFields`:

```ts
const { data: pricingRules } = useQuery({
  queryKey: ["public-pricing-rules", matchedServiceType?.id],
  queryFn: async () => {
    if (!matchedServiceType?.id) return [];
    const { data } = await (supabase as any)
      .from("service_pricing_rules")
      .select("id,service_type_id,category,unit_price")
      .eq("service_type_id", matchedServiceType.id);
    return data ?? [];
  },
  enabled: !!matchedServiceType?.id,
});

const { data: conditionSettings } = useQuery({
  queryKey: ["public-condition-settings"],
  queryFn: async () => {
    const { data } = await (supabase as any)
      .from("condition_settings")
      .select("id,name,surcharge_amount");
    return data ?? [];
  },
});

const { data: taxRate } = useQuery({
  queryKey: ["public-tax-rate"],
  queryFn: async () => {
    const { data } = await (supabase as any)
      .from("site_settings").select("setting_value").eq("setting_key", "tax_rate").maybeSingle();
    const n = parseFloat(data?.setting_value ?? "0");
    return Number.isFinite(n) ? n : 0;
  },
});
```
(`tax_rate` lookup is read-only and falls back to 0 if the setting doesn't exist — matches the engine's existing default.)

### 3b. Replace `parsePrice`-based estimate (L182–192)
Build the request object the engine expects, then call `computeQuote`:

```ts
const selectedAddonObjects = addons
  .filter(a => selectedAddons.includes(a.title))
  .map(a => ({ title: a.title, price_starting: a.price_starting }));

const pricingRequest = {
  service_type_id: matchedServiceType?.id ?? null,
  service_type: form.service || null,
  bedrooms: null, bathrooms: null,           // legacy; engine uses dynamic field_keys
  condition_level: form.condition_level || null,
  selected_addons: selectedAddonObjects,
  custom_fields: dynValues,                   // engine reads field_key from here
};

const computed = useMemo(() => computeQuote(
  pricingRequest,
  matchedServiceType ? [{ id: matchedServiceType.id, name: matchedServiceType.name, base_price: (matchedServiceType as any).base_price ?? 0 }] : [],
  pricingRules ?? [],
  conditionSettings ?? [],
  taxRate ?? 0,
  serviceFields ?? [],
), [matchedServiceType, pricingRules, conditionSettings, taxRate, serviceFields, dynValues, selectedAddons, form.condition_level]);
```

Note: `service_types` query (L75–82) currently selects only `id,name`. Update its SELECT to `id,name,base_price` so the engine receives the real base price.

### 3c. Replace the "Estimated Total" UI block (L500–518)
Render directly from `computed`:

```tsx
{form.service && computed.total > 0 && (
  <div className="bg-muted/50 rounded-lg p-4 space-y-1">
    {computed.lineItems.filter(i => i.total_price > 0).map((i, idx) => (
      <div key={idx} className="flex justify-between text-sm">
        <span className="text-muted-foreground">{i.name}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span>
        <span className="text-foreground">${i.total_price.toFixed(2)}</span>
      </div>
    ))}
    {computed.tax > 0 && (
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tax</span>
        <span className="text-foreground">${computed.tax.toFixed(2)}</span>
      </div>
    )}
    <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
      <span className="text-foreground">Estimated Total</span>
      <span className="text-primary">${computed.total.toFixed(2)}</span>
    </div>
  </div>
)}
```
Visually equivalent — no layout/redesign.

The success screen (L350) switches `${totalPrice.toFixed(2)}` → `${computed.total.toFixed(2)}`.

### 3d. Booking insert payload (L272–300)
Stop writing legacy `total_price`. Write the modern columns from the engine:

```ts
// removed: total_price: totalPrice > 0 ? totalPrice : null,
line_items:  computed.lineItems,
subtotal:    computed.subtotal,
tax_amount:  computed.tax,
total_amount: computed.total,
```

`selected_addons` keeps its existing `{ title, price }` shape (parsed from `price_starting`) so the booking detail UI doesn't change. The engine ignores this field except for re-computation; the source of truth is `line_items`.

### 3e. Remove now-unused locals
Delete `parsePrice`, `selectedMainService`, `mainPrice`, `addonPrices`, `totalPrice` from `BookService.tsx` (L183–192). All references are replaced by `computed`.

---

## 4. Downstream impact (verified, no changes needed)

- `create_invoice_from_booking` RPC reads `COALESCE(booking_record.subtotal, booking_record.total_price, 0)` and `COALESCE(booking_record.total_amount, booking_record.total_price, 0)`. Once Phase 1 is live, new bookings supply `subtotal/total_amount` directly — the `total_price` fallback simply becomes dormant for new rows. Historical bookings with only `total_price` still work via the COALESCE.
- `convert_quote_to_booking` writes both `total_amount` and the legacy `total_price` from quote drafts — left untouched (quote→booking path is out of scope for this phase).
- Receipts / `mark_invoice_paid` / `create_receipt` — untouched (Phase 1A backend remains paused per earlier instructions).
- `bookings.total_price` column itself is **not dropped**. Schema unchanged.

---

## 5. Files & operations

| Op | Target | Change |
|---|---|---|
| insert tool SQL | `condition_settings` | rename Post-Renovation → Post-Construction |
| insert tool SQL | `service_types`, `services`, `bookings`, `quote_requests` | rename Reccuring → Recurring Cleaning |
| insert tool SQL | `service_pricing_rules` | DELETE 35 dead capitalized $0 rows |
| code | `src/pages/BookService.tsx` | add `Light` option; add 3 queries; switch to `computeQuote`; rewrite estimate block; rewrite insert payload; remove dead helpers |
| code | `src/pages/RequestQuote.tsx` | add `Light` option only |
| code | `src/lib/pricingEngine.ts` | one-line comment cleanup on `PricingRule.category` doc (snake_case only) |

No new files. No schema migration. No RLS change. No edge function. No table deletion.

---

## 6. Verification after apply

1. `service_pricing_rules` row count drops by 35; only snake_case rows remain.
2. Selecting `Post-Construction` on a booking adds a `$100` surcharge line in the estimate.
3. Selecting `Light` on either form is accepted and adds a `$10` surcharge line in BookService.
4. Submitting a public booking writes `line_items`, `subtotal`, `tax_amount`, `total_amount` and leaves `total_price` NULL.
5. Generating an invoice from that booking copies the same `subtotal`/`total_amount` (verified through existing RPC's COALESCE behavior).
6. Estimate shown to the customer matches the totals an admin sees on the invoice.
