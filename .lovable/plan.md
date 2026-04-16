

# Fix MessagesAdmin Build Error

## Problem
Line 61 passes `Partial<ContactSubmission>` (which includes `admin_notes`) to `.update()`, but the auto-generated Supabase types in `types.ts` don't yet include `admin_notes` for `contact_submissions`. This causes `TS2345` — TypeScript sees `admin_notes` as `never`.

## Fix
**File: `src/pages/admin/MessagesAdmin.tsx`** — Cast the `updates` object to `any` when passing to `.update()` so it bypasses the stale generated types.

Change line 61 from:
```ts
const { error } = await supabase.from("contact_submissions").update(updates).eq("id", id);
```
to:
```ts
const { error } = await supabase.from("contact_submissions").update(updates as any).eq("id", id);
```

This is a single-line change. Once the Supabase types auto-regenerate to include `admin_notes`, the `as any` cast can optionally be removed, but it's harmless to keep.

