# Legal Pages Improvement — Phased Plan (Deferred)

> Saved: this is the prior approved audit-driven plan for the legal pages CMS
> system. Deferred while we land the PDF logo + ZIP soft-hide + condition_settings
> soft-hide work. Pick this up next session.

## Background

Legal pages (Privacy, Terms, etc.) are CMS-driven via the `page_content` table.
Content is stored as plain text in `page_content.content` and rendered by a
frontend parser that emits headings/lists/paragraphs heuristically. The Contact
legal page has additional ad-hoc fields (e.g. `contact_email`, `contact_phone`)
that the parser treats inconsistently versus the other legal pages.

## Problems by category

### A. Database / data model
- `page_content.content` is a single plain-text blob — no structured field
  separation, no formatting tokens.
- Contact-legal carries extra fields that are not represented uniformly across
  other legal pages.
- No schema-level distinction between metadata (page title, last_updated) and
  body content.

### B. Frontend rendering
- A bespoke parser turns plain text into headings, lists, paragraphs based on
  whitespace/punctuation heuristics. Fragile against admin formatting changes.
- No safe markdown or rich-text pipeline. Bold, links, ordered lists are not
  reliably supported.

### C. Admin UX
- Plain `<textarea>` editor — no preview, no formatting toolbar, no validation.
- Admin has no idea how the parser will interpret their input until they save
  and view the public page.

### D. Consistency
- Contact legal page renders differently from the other legal pages because of
  the extra fields and special-case parser branches.
- "Last updated" timestamp behavior is inconsistent across pages.

## Phase 1 — Stabilization (DB + parser hygiene)

Goal: make the existing system predictable without changing the content shape.

1. Add a versioned `format` column to `page_content` (e.g. `text` | `markdown`)
   with default `text`. Migrations only — no rendering change yet.
2. Lock the parser behavior behind that column so future content can opt in to
   markdown without breaking existing plain-text rows.
3. Normalize the Contact legal page so its extra fields render through the same
   parser path as the others (or split them into clearly-typed metadata).
4. Add admin-side preview that renders exactly what the public page will show.

## Phase 2 — Structured content

Goal: replace heuristic parsing with structured CMS blocks.

1. Migrate `page_content` to a structured representation (JSONB blocks: heading,
   paragraph, list, link, callout, contact_field).
2. Replace the heuristic parser with a typed block renderer.
3. Ship a block-based admin editor (drag-to-reorder sections, inline formatting).
4. Backfill existing plain-text rows into the block format with a one-time
   migration.

## Source-of-truth analysis

- Today: `page_content.content` (plain text) is the single source. Frontend
  parsing is the de facto schema.
- After Phase 2: structured blocks become the source of truth; renderer becomes
  a pure mapper.

## Final architectural recommendation

The system should evolve to **structured content** (Phase 2). The minimal path
to production-grade is Phase 1 first (`format` column + admin preview +
Contact-page normalization), then Phase 2 (structured blocks + block renderer).
Plain text + heuristic parser is not sustainable as the legal surface grows.

## Scope guardrails

- No code/UI changes are in this plan — execution is deferred.
- No destructive DB changes; all migrations are additive.
- Phase 1 is a strict prerequisite for Phase 2.
