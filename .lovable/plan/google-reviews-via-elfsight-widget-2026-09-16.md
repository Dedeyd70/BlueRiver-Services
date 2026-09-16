# Google reviews via Elfsight widget

Since Google's public business search still can't find the listing, the homepage will show your Elfsight Google Reviews widget instead, with your own site reviews kept right below it.

## What changes

1. **Elfsight widget on the homepage**
   - A new reviews block appears in the "What Our Customers Say" area, showing the Elfsight Google Reviews widget (app id `26484372-71e1-46a0-9e23-736cb47b2a36`).
   - The Elfsight platform script loads once, only on the homepage, and lazily so it doesn't slow down first paint.

2. **Your own reviews stay, underneath**
   - The existing cards of reviews customers left on your site remain below the widget, under a small heading like "Reviews left on our site".
   - The section now shows even when Elfsight is the only source of reviews.

3. **Old Google listing setup stays, but hidden**
   - The Settings → Google Reviews tab, the sync job and the cached reviews are left in place and untouched, just no longer shown on the public homepage.
   - If you verify the listing with Google later, it can be switched back on without rebuilding anything.

## Technical notes

- Add a small `ElfsightReviews` component: injects `https://elfsightcdn.com/platform.js` (async, once, guarded against duplicate insertion) and renders `<div class="elfsight-app-26484372-71e1-46a0-9e23-736cb47b2a36" data-elfsight-app-lazy />`.
- In `src/pages/Index.tsx`: render `ElfsightReviews` inside the reviews section, change the render condition from `allReviews.length > 0` to always-on, pass only `publicReviews` (drop `googleEnabled ? googleReviews : []` from the homepage combine) and hide the Google rating summary bar.
- `useGoogleReviews`, `google-reviews-sync`, the `google_reviews` table and `GoogleReviewsSettings` are left as-is.
