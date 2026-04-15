---
name: Implementation Roadmap
description: Production-ready sweep status — stability, forms, SEO, CMS logic
type: feature
---

## Completed (Production-Ready Sweep)
- **Stability**: All form inserts wrapped in try/catch/finally (BookService, RequestQuote, Contact). MessagesAdmin markRead error handling added.
- **US Phone validation**: `isValidUSPhone()` and `isValidZip()` in validation.ts, applied to all 3 forms.
- **Property detail fields**: property_type, sq_ft, bedrooms, bathrooms, frequency, has_pets, entry_codes added to BookService and RequestQuote.
- **Contact overhaul**: "Service Needed" → "Inquiry Type" (General, Billing, Feedback, Employment, Other). Static options, no service query.
- **Loading skeletons**: Index.tsx (services + testimonials), Services.tsx (main services).
- **JSON-LD LocalBusiness**: LocalBusinessSchema.tsx component added to App.tsx.
- **Convert to Booking**: MessagesAdmin has "Convert to Booking" button passing data via URL params.
- **BookService pre-fill**: Reads name/email/phone from URL search params.
- **Archive tabs**: BookingsAdmin splits Active (pending/confirmed) vs Archived (completed/cancelled).
- **Toast specificity**: All success/error toasts have specific contextual messages.
- **Property details in admin**: BookingsAdmin shows property_type, sq_ft, rooms, frequency, pets, entry codes.

## Remaining
- Transactional email notifications (edge functions)
- GA4 analytics integration
- Google Reviews / third-party social proof
- Customer self-service cancel/reschedule
- IP-based rate limiting / honeypot
- Blog/content marketing
- Multi-language support
- Service area map embed
