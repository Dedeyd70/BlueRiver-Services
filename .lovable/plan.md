

# Production-Ready Sweep: BlueRiver Services

## Overview
Four workstreams: stability fixes, form enhancements for Washington market, UI polish with SEO, and CMS/lead-flow improvements. ~15 files touched, 0 database schema changes needed (all new form fields already exist in the `bookings` and `quote_requests` tables).

---

## 1. Critical Stability — Fix "Freeze" & 400 Error

**Problem:** `setLoading(false)` is called inline after `.insert()` — if Supabase throws, loading stays stuck forever. `MessagesAdmin` doesn't check for errors on `.update()`.

**Files & Changes:**

### `src/pages/BookService.tsx` (lines 157–214)
- Wrap the insert block (lines 183–214) in `try { ... } catch { toast error } finally { setLoading(false) }`
- Remove the inline `setLoading(false)` on line 200

### `src/pages/RequestQuote.tsx` (lines 89–127)
- Same pattern: wrap lines 101–127 in `try/catch/finally`
- Remove inline `setLoading(false)` on line 113

### `src/pages/Contact.tsx` (lines ~45–75)
- Same pattern for the insert block
- Remove inline `setLoading(false)`

### `src/pages/admin/MessagesAdmin.tsx` (lines 27–30)
- Destructure `{ error }` from the `.update()` call
- `if (error) throw error;` so `onError` triggers
- Add `onError` callback to the mutation with a toast: "Failed to mark as read"

---

## 2. Market Readiness — Enhanced Forms

**No DB migrations needed.** The `bookings` table already has: `property_type`, `square_footage`, `bedrooms`, `bathrooms`, `frequency`, `has_pets`, `entry_codes`. The `quote_requests` table has the same columns.

### `src/pages/BookService.tsx`
- Expand `form` state to include: `property_type`, `square_footage`, `bedrooms`, `bathrooms`, `frequency`, `has_pets`, `entry_codes`
- Add form fields after the Address field:
  - **Property Type** — dropdown: House, Apartment/Condo, Office, Other
  - **Sq Ft** — text input, placeholder "e.g. 1500"
  - **Bedrooms / Bathrooms** — two number inputs side by side
  - **Frequency** — dropdown: One-Time, Weekly, Bi-Weekly, Monthly
  - **Pets** — Yes/No toggle (checkbox)
  - **Entry/Gate Codes** — text input, placeholder "Gate code, lockbox, etc."
- Include all new fields in the `.insert()` payload
- Add US phone format validation: `/^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/`

### `src/pages/RequestQuote.tsx`
- Add the same property detail fields (all optional)
- Include in `.insert()` payload
- Add US phone validation

### `src/pages/Contact.tsx`
- Rename "Service Needed" label to **"Inquiry Type"**
- Replace service dropdown options with: General Inquiry, Billing Question, Feedback, Employment, Other
- Add **"Preferred Contact Method"** dropdown: Email, Phone, Text
- Add US phone validation when phone is provided

### Validation utility (`src/lib/validation.ts`)
- Add `isValidUSPhone(phone: string): boolean` — validates `(XXX) XXX-XXXX` and common US formats
- Add `isValidZip(zip: string): boolean` — validates 5-digit zip codes
- Apply phone validation across all three forms (only when phone field is non-empty)

---

## 3. UI Polish & Trust Signals

### Loading Skeletons
**`src/pages/Index.tsx`**
- Import `Skeleton` from `@/components/ui/skeleton`
- Wrap the services cards section: if `isLoading`, render 3 skeleton cards (h-48 rounded-xl)
- Wrap testimonials section similarly

**`src/pages/Services.tsx`**
- Add `isLoading` from the `useQuery` return
- Show skeleton cards while loading

### JSON-LD LocalBusiness Schema
**`src/components/LocalBusinessSchema.tsx`** (new file)
- Render a `<script type="application/ld+json">` tag with LocalBusiness schema
- Pull business name, phone, email, service area from `useSiteSettings()`
- Include: `@type: LocalBusiness`, `areaServed: Washington State`, `telephone`, `email`, `openingHours`

**`src/App.tsx`**
- Import and render `<LocalBusinessSchema />` once at the app level

### Hero Image
- Already uses `object-cover object-center` — confirmed correct on lines 134 and 143 of `Index.tsx`
- No changes needed here

---

## 4. CMS Logic & Lead Flow

### Convert Contact to Booking
**`src/pages/admin/MessagesAdmin.tsx`**
- Add a "Convert to Booking" button on each contact card
- On click, navigate to `/book?name={}&email={}&phone={}&service={}` using React Router `useNavigate`

**`src/pages/BookService.tsx`**
- Read `name`, `email`, `phone` from URL search params to pre-fill the form (extend existing `useSearchParams` logic)

### Archive Logic
**`src/pages/admin/BookingsAdmin.tsx`**
- Filter the default view to show only `pending` and `confirmed` bookings
- Add a toggle/tab: "Active" vs "Archived" (completed + cancelled)

### Toast Specificity
- BookService success: "Booking confirmed! We'll be in touch within 24 hours." (already close, refine wording)
- RequestQuote success: "Quote received! Expect a reply within 24 hours."
- Contact success: "Message sent! We'll respond within 24 hours."
- All error toasts: include the specific action that failed

---

## Implementation Order
1. `src/lib/validation.ts` — add phone/zip validators
2. Stability fixes: BookService, RequestQuote, Contact, MessagesAdmin (`try/finally`)
3. Form enhancements: BookService property fields, RequestQuote property fields, Contact inquiry overhaul
4. UI: Skeleton components in Index.tsx and Services.tsx
5. SEO: New `LocalBusinessSchema.tsx` component + add to App.tsx
6. CMS: MessagesAdmin "Convert to Booking" + BookingsAdmin archive filter
7. Toast message refinements across all forms

**Estimated file changes:** 10 modified, 1 new component

