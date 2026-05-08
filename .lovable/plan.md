
# Professional Legal Pages Renderer — Frontend Only

## Files

**New:** `src/components/LegalContent.tsx` — pure presentation component.

**Modified (presentation only):**
- `src/pages/PrivacyPolicy.tsx`
- `src/pages/TermsOfService.tsx`
- `src/pages/LiabilityDisclaimer.tsx`
- `src/pages/CancellationPolicy.tsx`

**Untouched:** all admin pages, `page_content` schema, RLS, routes, hero sections, Navbar, Footer.

## Why this is safe

- Admin keeps the same plain-text `Textarea` writing `{ body: string }` to `page_content.content`. No new fields, no markdown requirement.
- Pure read-path change. No DB migration, no API change.
- No `dangerouslySetInnerHTML`. All content rendered as React text nodes inside semantic tags — XSS posture unchanged.
- Worst-case parser misclassification = a heading where a paragraph was expected. No content is ever lost or hidden.
- Empty body → `"Content not available"`. Loading → existing loader preserved.
- Existing Privacy Policy contact card (email/phone) stays intact below the rendered body.

## Renderer behavior

Input is split on blank lines into **blocks**. Each block is classified in order:

1. **List block** — every non-empty line matches a marker:
   - `-`, `*`, `•` → `<ul>`
   - `1.`, `1)`, `a)` → `<ol>`
   - Markers stripped; rendered as `<li>`.
2. **Heading block** — single short line:
   - Matches `^\d+(\.\d+)*[.)]?\s` (e.g. `1.`, `2.3`, `1.1`) → `<h3>`.
   - Otherwise short title-like (≤ 70 chars, ≤ 10 words, no terminal `.,;:?!`) → `<h2>`.
3. **Paragraph block** — default. Internal line breaks preserved via `whitespace-pre-line`.

**Last updated:** if `updatedAt` provided, shows muted `Last updated: <localized date>` directly under the page hero / above the body. Hidden if missing.

## Design

- Container: `max-w-3xl mx-auto`.
- Wrapper: `prose prose-slate max-w-none space-y-5` using semantic tokens (`text-foreground`, `text-muted-foreground`, `border-border`).
- `<h2>`: `mt-10 mb-3 text-2xl font-display font-bold text-foreground` (first heading gets `mt-0`).
- `<h3>`: `mt-6 mb-2 text-lg font-display font-semibold text-foreground`.
- `<p>`: `leading-relaxed text-foreground/85 whitespace-pre-line`.
- `<ul>` / `<ol>`: `pl-6 space-y-2 marker:text-primary` with `list-disc` / `list-decimal`.
- Hero sections of each page remain unchanged (sole `<h1>`).

## Page integration

Each public page becomes:

```tsx
<LegalContent body={content?.body} updatedAt={data?.updated_at} />
```

Public queries change `select("content")` → `select("content, updated_at")` (no schema change — column already exists).

## Technical notes

- ~120-line component, no new dependencies.
- Pure function; memoized parser keyed on `body`.
- All Tailwind classes use existing design tokens — no hardcoded colors.

Ready to implement after approval.
