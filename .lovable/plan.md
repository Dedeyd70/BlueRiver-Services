# Three Targeted Fixes + Save Legal Plan

## 0. Save legal-pages plan for later

- **New file:** `.lovable/plans/legal-pages-improvement.md` — verbatim copy of the prior approved Phase 1/Phase 2 legal-pages plan (problems by category A–D, Phase 1 DB fixes, Phase 2 app fixes, source-of-truth analysis, final recommendation).

Planning artifact only; no code touched by this step.

---

## 1. Invoice + Quote logo — use uploaded brand logo, not the "BR" placeholder

**Files**
- `src/lib/invoicePdf.ts` — replace placeholder badge in `drawLetterhead`.
- `src/lib/quotePdf.ts` — same replacement (identical letterhead with "BR" badge).

**Today's behavior**
Both PDFs draw a colored rounded-rect with the literal text `"BR"` at top-left (`invoicePdf.ts:36-45`, `quotePdf.ts:67`). `DocumentsPdfSettings.tsx` already renders `branding.logo_url` when set and falls back to "BR" otherwise — but the PDFs never read `logo_url`.

**Fix**
1. Add async helper `loadLogoDataUrl(url)`:
   - Fetch the image (Supabase storage public URL).
   - Convert to data URL via `FileReader` / `blob.arrayBuffer()`.
   - Return `null` on failure (network, CORS, missing).
2. In `buildInvoiceDoc` / `buildQuoteDoc`, accept optional `logoDataUrl: string | null` parameter — keeps the build functions synchronous so existing serialization paths still work.
3. Make public entry points async: `generateInvoicePdf`, `generateInvoicePdfBase64`, and the `quotePdf.ts` equivalents. They `await` the loader and pass `logoDataUrl` through.
4. In `drawLetterhead`:
   - If `logoDataUrl` present → `doc.addImage(logoDataUrl, 'PNG', badgeX, badgeY, badgeSize, badgeSize, undefined, 'FAST')`.
   - Else → keep current "BR" fallback unchanged.
5. Update every caller of `generateInvoicePdf*` / `generateQuotePdf*` to `await`.

**Safety**
- Fallback path preserved → no logo means current behavior.
- Network/CORS failure → "BR" fallback.
- Compression budget unchanged (single raster).
- No DB or schema change.

---

## 2. ZIP code — soft hide (Option A, reversible)

ZIPs are **hidden, not deleted**. DB column stays NOT NULL; new rows insert `zip: ""`. Restoring later = re-add the input + swap city back to zip in displays. Existing historical ZIPs are preserved.

| File | What's there | Action |
|---|---|---|
| `src/lib/validation.ts` | `ZIP_RE`, `isValidZip` | Remove both (no remaining imports). |
| `src/components/admin/ServiceAreasSettings.tsx` | UI keyed entirely on ZIP | Refactor to **cities only**: drop ZIP input + ZIP column, sort by `city`, drop `^\d{5}$` validator, insert with `zip: ""`. |
| `src/hooks/useServiceAreas.ts` | `.order("zip")`, `zip` in type | Change to `.order("city")`, mark `zip` optional. |
| `src/components/Footer.tsx` (line 93) | "Serving Bellevue: 98004…" | Show deduped city list: "Serving Bellevue, Redmond, …". |
| `src/pages/RequestQuote.tsx` (line 350) | Same ZIP-list string | Same — city list. |
| `src/pages/BookService.tsx` (line 534) | Same | Same — city list. |
| `src/pages/Contact.tsx` (line 319) | "ZIPs: 98004…" | Replace with "Cities: …". |
| `src/components/LocalBusinessSchema.tsx` | `@type: PostalAddress` JSON-LD | **Keep** — schema.org structural type, not a postal code. |
| `src/integrations/supabase/types.ts` | Auto-generated, contains `zip` column | Do not touch. |

**Safety** — No customer-facing form collects ZIP; address fields are free-text and untouched; routing/RLS unaffected.

---

## 3. `condition_settings` — soft hide (Option A, reversible)

Table left intact, just unread/unwritten. Multiplier engine is already the live calculation path.

**Files**
- `src/lib/pricingEngine.ts` — remove `ConditionSetting` interface, `conditions` parameter from `computeQuote`, and the `void conditions;` line.
- `src/pages/BookService.tsx` (lines 161–165, 297, 302) — drop the `conditionSettings` query and its `useMemo` / `computeQuote` usage.
- `src/pages/admin/QuotesAdmin.tsx` (lines 216–219, 459, 473) — drop the `conditionSettings` query; stop passing it to `computeQuote`.
- `src/components/admin/PricingSettings.tsx` — remove the entire "Condition Settings" UI: query (line 56), mutation (line 168), and rendered block. Multipliers UI keeps full control over the `condition` axis.
- `src/lib/__tests__/pricingEngine.test.ts` — update the two legacy tests (lines 127, 146); since they exist to verify the legacy path is ignored, simplify or remove them now that the parameter is gone.

**Safety** — No other table or RPC references `condition_settings`.

---

## Out of scope (explicit)

- No legal-pages code changes (plan saved separately for next session).
- No Supabase schema migrations.
- No design-system or token changes.

## Order of execution

1. Save the legal-pages plan file.
2. Invoice + quote PDF logo (two files + callers).
3. ZIP soft-hide sweep (8 files).
4. `condition_settings` soft-hide (5 files + tests).
5. Verify: build passes, vitest pricing suite passes, generated invoice logo matches the Documents & PDF preview.
