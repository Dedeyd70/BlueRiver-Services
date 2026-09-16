# Switch the homepage back to the Elfsight reviews widget

Google's own reviews feed still isn't working, so the homepage goes back to showing your Elfsight Google Reviews widget, with reviews left on your site kept underneath.

## What changes

1. **Elfsight widget returns to the homepage**
   - The "What Our Customers Say" area shows the Elfsight Google Reviews widget (app id `26484372-71e1-46a0-9e23-736cb47b2a36`).
   - The widget script loads once, only on the homepage, and lazily so the page still opens fast.

2. **Your own site reviews stay below it**
   - Existing review cards remain underneath, under a small heading "Reviews left on our site".
   - The section shows even when the widget is the only source of reviews.

3. **Google listing setup stays, just hidden**
   - The Settings → Google Reviews tab, the saved listing details and the sync job stay exactly as they are, simply not used on the public homepage.
   - Once Google can find your listing, it can be switched back on without rebuilding anything.

## Technical notes

- Re-add `src/components/ElfsightReviews.tsx`: injects `https://elfsightcdn.com/platform.js` (async, once, guarded against duplicate insertion) and renders `<div class="elfsight-app-26484372-71e1-46a0-9e23-736cb47b2a36" data-elfsight-app-lazy />`.
- In `src/pages/Index.tsx`: render `ElfsightReviews` at the top of the reviews section, change the condition from `allReviews.length > 0` to always-on, and build the card list from `publicReviews` only (drop `googleEnabled ? googleReviews : []`), hiding the Google rating summary.
- `useGoogleReviews`, `google-reviews-sync`, the `google_reviews` table and `GoogleReviewsSettings` are left untouched.
