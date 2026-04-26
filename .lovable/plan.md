# Phase 2 Stabilization — RLS UPDATE Policies + Global Safe-Update Pattern

Three coordinated changes, all additive and backward-compatible. No schema changes, no UI changes, no renames.

---

## Part 1 — Add three RLS UPDATE policies (migration)

A single migration adds the missing `UPDATE` policies. Existing admin-only policies stay in place; these are purely additive so admin behavior is unchanged.

```sql
-- Quotes
CREATE POLICY "Permitted users can update quotes"
ON public.quote_requests
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_manage_quotes'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_manage_quotes'));

-- Bookings
CREATE POLICY "Permitted users can update bookings"
ON public.bookings
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_manage_bookings'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_manage_bookings'));

-- Contact / Messages
CREATE POLICY "Permitted users can update contact_submissions"
ON public.contact_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_manage_messages'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_manage_messages'));
```

This unblocks managers and staff who hold the right permission flag — fixing the silent-failure root cause behind "Convert to Booking leaves quote In Progress", "Confirm doesn't change status", etc.

---

## Part 2 — Apply the safe-update pattern to **every** `.update()` call

Rule applied uniformly:

```ts
const { data, error } = await supabase
  .from("table").update({...}).eq("id", id)
  .select("id").maybeSingle();
if (error) throw error;
if (!data) throw new Error("Update blocked by permissions or RLS");
```

Audit found **25 `.update()` call sites** across 16 files. All will be upgraded:

| File | Lines | Notes |
|---|---|---|
| `src/pages/admin/QuotesAdmin.tsx` | 189, 204, 349 | mark in-progress, close, convert→converted |
| `src/pages/admin/BookingsAdmin.tsx` | 93, 110, 145 | confirm, complete, cancel |
| `src/pages/admin/MessagesAdmin.tsx` | 57 | status updates |
| `src/pages/admin/InvoicesAdmin.tsx` | 160 | applyPayment |
| `src/pages/admin/UserManagement.tsx` | 90, 141 | role, permissions |
| `src/pages/admin/PermissionsAdmin.tsx` | 46 | registry edits |
| `src/pages/admin/ServicesAdmin.tsx` | 56 | service edits |
| `src/pages/admin/TestimonialsAdmin.tsx` | 49 | testimonial edits |
| `src/pages/admin/GalleryAdmin.tsx` | 127 | gallery edits |
| `src/pages/admin/HomepageImagesAdmin.tsx` | 38 | image url |
| `src/pages/admin/LegalAdmin.tsx` | 42 | legal body |
| `src/pages/admin/TermsAdmin.tsx` | 38 | terms body |
| `src/pages/admin/PrivacyPolicyAdmin.tsx` | 43 | privacy body |
| `src/components/admin/SocialLinksSettings.tsx` | 61 | social link edit |
| `src/components/admin/PricingSettings.tsx` | 123, 142, 161, 218 | base/unit/surcharge/multi-field |
| `src/components/admin/NotificationBell.tsx` | 40, 51 | mark single read, mark many read (uses `.in(...)` — pattern adapted to `.select("id")` array length check; throw if zero rows returned) |

Multi-row updates (`NotificationBell` `markAllRead`) use `.select("id")` and throw if the returned array is empty rather than `maybeSingle()`.

No function names, button labels, or UI flow change — only the await-chain inside each mutation gets `.select("id").maybeSingle()` plus the empty-row guard.

---

## Part 3 — Idempotency softening

Two existing guard sites currently throw when a record already exists. Switch to safe return so retries don't surface false errors:

| File | Current | Change |
|---|---|---|
| `src/pages/admin/QuotesAdmin.tsx` `convertToBooking` | throws when booking exists for `quote_id` | return existing booking |
| `src/lib/createInvoiceFromBooking.ts` | already returns existing — verify only | (no change needed; already safe) |

After Part 1's RLS fix, the convert flow will also succeed in flipping the quote status to `converted`, so the button no longer lingers.

---

## Compatibility guarantees

- **No schema changes.** No new tables, no new columns, no renames.
- **Additive RLS.** Existing admin-only policies untouched; new policies grant the same operation to permitted non-admins.
- **No UI / layout / naming changes.** Only the body of each `.update()` await chain changes.
- **No new mutations or duplicate flows.** Same buttons, same handlers, same toasts.
- **Error surfacing.** Silent RLS denials now produce a visible toast instead of fake success.
- **Idempotency.** Convert-to-booking becomes safe to click twice; returns the existing booking row.

---

## Files touched

- New migration: 3 `CREATE POLICY` statements (Part 1)
- 16 source files: `.update()` chains upgraded to safe pattern (Part 2)
- `src/pages/admin/QuotesAdmin.tsx`: `convertToBooking` early-return on existing booking (Part 3)

All changes deploy in a single pass.
