## Goal
Send transactional emails (booking + quote confirmations) from `BlueRiver Services <info@blueriverservices.co>` via Resend, plus update success toasts to mention the confirmation email.

## Prerequisite (one-time, by you)
1. Verify the domain `blueriverservices.co` in your Resend dashboard (DNS: SPF, DKIM, DMARC). Required before Resend will send from `info@blueriverservices.co`.
2. Create a Resend API key — I'll request it via the secret tool so you can paste it in.

## Implementation

### 1. New Edge Function: `send-transactional-email`
Path: `supabase/functions/send-transactional-email/index.ts`

- Public endpoint (no JWT verification) so the public booking/quote forms can call it.
- Uses CORS headers.
- Validates request body with Zod: `{ type: 'booking_confirmation' | 'quote_received' | 'custom', to: string(email), data: object, subject?, html? }`.
- Reads `RESEND_API_KEY` from secrets.
- Sends via Resend REST API (`https://api.resend.com/emails`) with:
  - `from: "BlueRiver Services <info@blueriverservices.co>"`
  - `reply_to: "info@blueriverservices.co"`
- Holds simple inline HTML templates for `booking_confirmation` and `quote_received`, easy to customize later. Each template uses brand blue/white styling and inserts the customer name, service, date, time, and total.
- Returns `{ id }` on success, `{ error }` on failure.
- Errors are logged but never break the form submission (caller wraps in try/catch).

No `supabase/config.toml` change needed — default `verify_jwt = false` for new Lovable functions.

### 2. Wire up triggers
**`src/pages/BookService.tsx`** (after line 409, before toast):
After successful booking insert, fire-and-forget:
```ts
supabase.functions.invoke('send-transactional-email', {
  body: {
    type: 'booking_confirmation',
    to: form.email.trim(),
    data: { name: form.name, service: serviceName, date, timeSlot, total },
  },
}).catch((err) => console.error('Email send failed:', err));
```

**`src/pages/RequestQuote.tsx`** (after line 225):
Same pattern with `type: 'quote_received'` and quote-specific data.

### 3. Update success toasts
- BookService line 415 description → `"We'll be in touch within 24 hours. Check your inbox for a confirmation from info@blueriverservices.co. If you don't see it, please check your spam folder and mark us as a safe sender!"`
- RequestQuote line 231 description → `"Expect a reply within 24 hours. Check your inbox for a confirmation from info@blueriverservices.co. If you don't see it, please check your spam folder and mark us as a safe sender!"`

### 4. Secret
Use `add_secret` to request `RESEND_API_KEY`. I'll only request it after you confirm to proceed (per integration policy).

## Files
- **New**: `supabase/functions/send-transactional-email/index.ts`
- **Modified**: `src/pages/BookService.tsx`, `src/pages/RequestQuote.tsx`

## Testing
- Run existing Vitest suite — no test changes; data-mapping tests remain valid.
- After deploy, manually submit a booking on the preview to verify Resend dashboard shows a delivered email.

## Notes
- Future templates (e.g., admin notification, invoice, reschedule) can be added by extending the `type` switch in the Edge Function — no new function per template.
- Recommend (separate task) also wiring an admin notification email to `info@blueriverservices.co` on each new booking/quote — happy to add in a follow-up if you want.
