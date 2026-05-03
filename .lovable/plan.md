## Conflict Lockdown & Ultra-Light Attachments

### 1. DB migration — conflict lockdown

New migration file:
- Update `public.get_booked_slots(date)` to also return rows where `status = 'completed'` (currently only `pending`/`confirmed`).
- Update `public.check_slot_overlap(...)` to include `'completed'` in its status filter.
- **De-duplicate existing rows** before recreating the index. For each `(booking_date, time_slot)` group across `pending`/`confirmed`/`completed` with COUNT > 1, keep the newest `created_at` row and mark older ones `status = 'cancelled'` with an audit note appended to `notes`. Confirmed via DB query — there are exactly 3 affected groups (2026‑05‑01 `11:00 AM - 3:00 PM`, 2026‑04‑30 `7:00 AM - 11:00 AM`, 2026‑04‑30 `3:00 PM - 7:00 PM`).
- Drop and recreate `idx_unique_confirmed_booking_slot` so its `WHERE` clause includes `'completed'` alongside `pending`/`confirmed`.
- Bonus: log each demoted booking via `booking_activity_logs` with action `cancelled` so admins see why.

### 2. Ultra-light PDF generators

`src/lib/invoicePdf.ts` and `src/lib/quotePdf.ts`:
- Initialize jsPDF with `new jsPDF({ compress: true })` in both generators.
- No `addImage` calls today (badge is drawn with `roundedRect` + text), so the JPEG/0.6 quality rule applies only IF a logo image is later introduced — add a code comment documenting the requirement so future edits stay compliant.
- Add new exported helpers without breaking existing download flow:
  - `generateInvoicePdfBase64(inv, branding, settings) => { filename, base64 }`
  - `generateQuotePdfBase64(quote, branding, settings, draft) => { filename, base64 }`
- Internally extract the existing build code into a `build*Doc(...)` function returning the `jsPDF` instance. The existing `generateInvoicePdf` / `generateQuotePdf` keep calling `doc.save(...)` for the download UX. The new base64 helpers call `doc.output("datauristring").split(",")[1]`.
- Filenames: `BlueRiver_Invoice_<invoice_number_or_id8>.pdf`, `BlueRiver_Quote_<id8>.pdf`.

### 3. Edge function — `send-transactional-email/index.ts`
- Extend `Payload` with `attachments?: { filename: string; content: string }[]`.
- Validation (return 400 on failure, log reason):
  - Max **2** attachments per request.
  - Each attachment: filename must end in `.pdf`, base64 content decoded size ≤ **1 MB**, total ≤ **2 MB**.
- Forward as `attachments: [{ filename, content }]` in the Resend POST body. Resend accepts base64 `content` directly.
- Keep `FROM = "BlueRiver Services <info@blueriverservices.co>"` and `REPLY_TO = "info@blueriverservices.co"` exactly as today.
- Redeploy via `supabase--deploy_edge_functions`.

### 4. UI wiring

`src/pages/admin/BookingsAdmin.tsx`:
- `handleSendInvoice`: build attachment via `generateInvoicePdfBase64(inv, branding, pdfSettings)`. Pass `attachments: [{ filename, content: base64 }]` into the `invoke` call. On the invoke promise: `.then` keeps the success toast, `.catch` shows `toast({ title: "Failed to send email with attachment. Please try again.", variant: "destructive" })` and `console.error(err)`. Only fire the success toast after the promise resolves (replace current fire-and-forget pattern).
- `handleRescheduleConfirm`: catch the Postgres error and surface error code `23505` as `toast({ title: "This slot is already occupied (Confirmed/Completed).", variant: "destructive" })`. Other errors keep `friendlyRpcError` path.

`src/pages/admin/QuotesAdmin.tsx`:
- `handleSendQuote`: same attachment pattern using `generateQuotePdfBase64(q, branding, settings, draftMap[q.id])`. If no draft exists yet, show toast asking admin to prepare quote first (mirrors `handleDownloadPdf`). Same success/error toast flow as invoice path.

### 5. Sender identity
- `FROM` constant in the edge function stays hardcoded to `BlueRiver Services <info@blueriverservices.co>` — verified in current source. No changes needed.

### Files touched
- New SQL migration (RPCs + dedup + unique index recreate)
- `supabase/functions/send-transactional-email/index.ts` (+ deploy)
- `src/lib/invoicePdf.ts`
- `src/lib/quotePdf.ts`
- `src/pages/admin/BookingsAdmin.tsx`
- `src/pages/admin/QuotesAdmin.tsx`

### Out of scope
- Customer-facing booking/quote confirmation emails do not get attachments (no PDF context at submit time).
- No changes to `InvoicesAdmin.tsx` send paths (not requested).
- Brand asset image-based logo (still drawn programmatically; documented for future).
