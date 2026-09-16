---
name: Google Reviews
description: Google listing reviews cached in google_reviews, synced by an admin-gated edge function, shown beside on-site reviews
type: feature
---

- Google Maps Platform connector (gateway-backed, server-side only) supplies Places API data.
- Edge function `google-reviews-sync`: actions `lookup` (text search / place-id from a pasted Maps link) and `sync` (Place Details → `google_reviews` cache + `site_settings` keys `google_place_id`, `google_place_name`, `google_rating`, `google_rating_count`, `google_maps_uri`, `google_reviews_synced_at`, `google_reviews_enabled`).
- Requires admin or `can_manage_settings`. Cron mode (`{"cron":true}`) is sync-only and throttled to once per 12 hours; daily job `google-reviews-daily-sync` at 03:00 UTC.
- Homepage merges Google + approved on-site reviews via `combineReviews` in `src/hooks/useGoogleReviews.ts`, newest first, with "Google" / "Verified customer" badges. Google only ever returns up to 5 reviews.
- Attribution: show author name and photo, never edit review text, link back to the Google listing.
- Admin UI: Settings → Google Reviews tab. On-site `reviews` table, `submit_review` RPC and moderation are untouched.
- After-service review email offers both "Leave a review on our site" and "Review us on Google".
