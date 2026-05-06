## Goal

Add a single **Documents & PDF** settings tab that consolidates every value used by the invoice / quote / receipt PDF generators, expose two fields that currently have no UI (`company_address`, `brand_color_hex`), and add two new optional footer fields (`invoice_footer_note`, `invoice_terms`). Keep all existing security in place — no route changes, no new public endpoints, no new RPCs.

## 1. Security preservation (no changes, just verification)

- New tab is rendered inside `SettingsAdmin.tsx`, which lives under `AdminLayout` and the existing `AdminGuard` at `/onpass-useradmin-blueriveracess052026/...`. No new routes or exports.
- Tab gated by the same `useHasPermission("can_manage_settings")` already used by the Business Info tab.
- All reads/writes go through `supabase.from("site_settings").select/upsert(...)` — parameterized via the SDK, never string-concatenated.
- No `dangerouslySetInnerHTML`. All field values render through standard React text nodes / `value` props.
- Color and address inputs validated client-side: hex must match `/^#[0-9a-fA-F]{6}$/`; address truncated at 200 chars; footer note / terms truncated at 300 chars.
- No DB migration required — `site_settings` is already a key/value table with admin RLS.

## 2. New panel: `src/components/admin/DocumentsPdfSettings.tsx`

Sections:

1. **Letterhead (read-only mirror)**
   - Business name — pulled from `branding_settings.business_name`, shown as static text with a "Edit in Branding →" link.
   - Logo — small thumbnail of `branding_settings.logo_url`, same link.

2. **Brand color**
   - `brand_color_hex` — `<input type="color">` + text field, validated. Empty value falls back to default navy in PDFs.

3. **Contact block (these write to `site_settings` and stay in sync with Business Info)**
   - `phone`
   - `email`
   - `company_address` — `<Textarea>`, multi-line.

4. **Footer**
   - `invoice_footer_note` — `<Textarea>`, optional. Printed at bottom of every invoice/receipt if non-empty.
   - `invoice_terms` — `<Input>`, optional one-liner (e.g. "Net 7 — please pay within 7 days").

5. **Live PDF letterhead preview**
   - Inline mock styled as a navy band + brand-color badge + business name + tagline + contact line. Updates instantly as the user edits color/address/phone/email. Pure DOM, no PDF rendering.

Implementation pattern mirrors `BusinessInfoSettings.tsx`:
- `useQuery` for `site_settings` and `branding_settings`.
- Local `form` state, "Save" button calls `supabase.from("site_settings").upsert({ setting_key, setting_value }, { onConflict: "setting_key" })` for each editable key.
- On success, invalidate `["admin-settings"]`, `["site-settings"]`, `["admin-branding"]`, `["public-branding"]` so Business Info, Branding, and the public site all reflect the change immediately.

## 3. Register the tab in `SettingsAdmin.tsx`

Add one entry to the `tabs` array (between Business Info and Business Rules):

```ts
{ value: "documents-pdf", label: "Documents & PDF",
  allowed: canManageSettings,
  content: <DocumentsPdfSettings /> }
```

## 4. PDF generator updates

### `src/lib/invoicePdf.ts`

- `drawLetterhead` already reads `settings.company_address` ✅ — no change needed there; setting it via the new tab will make it appear automatically.
- `resolvePrimary` already reads `settings.brand_color_hex` ✅ — same.
- After the existing "Payment Instructions" block (around line 286), before the thank-you, add an **optional terms** line if `settings.invoice_terms` is non-empty.
- Replace the hard-coded thank-you with: if `settings.invoice_footer_note` is set, render that wrapped in `splitTextToSize`; otherwise keep the current "Thank you for choosing BlueRiver Services." default.

### `src/lib/quotePdf.ts`

- Same `drawLetterhead` already supports `company_address` and `brand_color_hex` ✅.
- After the existing "Notes" block, before "Availability", render `invoice_terms` as a small "Terms" line if present.
- Replace the final "Thank you…" line with `invoice_footer_note` when set.

(Both files already pass `settings` end-to-end from the callers, which load `site_settings` via `useSiteSettings`. No caller changes needed.)

## 5. Data integrity / sync

Because `phone`, `email`, and `company_address` are all stored as rows in the single `site_settings` table keyed by `setting_key`:

- Editing them in **Documents & PDF** writes the same rows used by **Business Info**, the public footer, and the email templates — they cannot drift.
- After save, invalidating `["admin-settings"]` and `["site-settings"]` causes Business Info and the public site to re-fetch and show the new values without reload.

## 6. Verification

1. Open Settings → **Documents & PDF**, set a brand color (e.g. `#2563eb`), a `company_address`, and a footer note. Save.
2. Reopen **Business Info** — confirm `phone`, `email` are unchanged and that editing them there still works.
3. Generate an invoice PDF from a booking — confirm the letterhead band uses the new brand color, the address appears in the contact line, and the footer shows the custom note.
4. Generate a quote PDF — same checks.
5. Confirm the admin route is still `/onpass-useradmin-blueriveracess052026/...` and that signing out makes `/onpass-useradmin-blueriveracess052026/settings` render the standard 404 page.
