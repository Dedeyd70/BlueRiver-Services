# Google Reviews on the website

## Recommendation

Keep both. Your own reviews are tied to completed bookings and you control them; Google reviews carry outside credibility. Showing them side by side, each with a small source label, gives the strongest social proof. Google only lets us pull the 5 reviews it picks, so relying on Google alone would leave the homepage thin.

## What you'll see

**Homepage reviews section**
- One combined section showing Google reviews and your approved on-site reviews together.
- Each card shows the stars, the comment, the reviewer name, and a small tag: "Google" or "Verified customer".
- Above the cards: your Google star average, total number of Google ratings, and a "See all reviews on Google" link.
- If Google is temporarily unreachable, the section still shows your own reviews.

**Admin (Settings)**
- A "Google Reviews" panel where you paste your Google listing name or Maps link, confirm the matched business, and switch the Google feed on or off.
- A "Refresh now" button, plus a note showing when reviews were last updated.
- Your existing review moderation stays exactly as it is.

**After-service email**
- The review invite offers two buttons: "Review us on Google" and "Leave a review on our site".

## How it works behind the scenes

- Connect the Google Maps Platform connector (Places API, server side only — required since browser Places access ended in September 2026).
- New backend function `google-reviews-sync`:
  - Admin-only "lookup" mode: text search by business name, returns candidate places for the admin to confirm; stores the chosen place ID in `site_settings`.
  - "Sync" mode: Place Details with field mask `id,displayName,rating,userRatingCount,googleMapsUri,reviews`, writes results into a new `google_reviews` cache table (author name, profile photo URL, rating, text, relative time, publish time) plus rating/count/URI into `site_settings`.
  - Cached, not called per page view — a scheduled daily sync plus the manual admin refresh. This keeps Maps usage inside the gateway's daily limits and avoids cost spikes.
- New table `public.google_reviews` with GRANTs: `SELECT` to `anon` and `authenticated` (public display), `ALL` to `service_role`; RLS enabled, public read policy, writes only from the service role in the edge function.
- Homepage: a `useCombinedReviews` hook merges `google_reviews` with the existing `public-reviews` query, sorts newest first, and renders one card component with a `source` badge. Existing `reviews` table, `submit_review` RPC, and admin moderation are untouched.
- Attribution rules respected: Google author name and photo shown, text not edited, link back to the Google listing.

## Steps

1. Link the Google Maps Platform connector.
2. Create the `google_reviews` table and settings keys.
3. Build the `google-reviews-sync` edge function (lookup + sync, admin-authenticated).
4. Add the admin "Google Reviews" panel with business lookup, toggle, and refresh.
5. Schedule the daily sync.
6. Rework the homepage reviews section into the combined, source-labelled layout.
7. Add the Google review button to the after-service review invite email.

## Note

If the Google listing has fewer than about 3 reviews, the combined section will lean on your own reviews until more come in.
