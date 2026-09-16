# Paste your Google listing link or ID directly

Goal: in Settings, you paste either your Maps link (`maps.app.goo.gl/ZyvSvh4qkekSFX118`) or your Place ID (`ChIJg9A1sZRTeG4R2KHA7y2e5Q0`), press Save, and the site pulls your star rating, total review count, and the review items straight from Google — no name search involved.

## What changes

**Settings → Google Reviews**
- The single box becomes "Paste your Google Maps link or Place ID" with a **Save & pull reviews** button.
- If what you paste contains a Place ID (or is one), it goes straight to Google's place details — the name-search step is skipped entirely.
- A short link is opened first; if it still hides the ID, you get a clear message asking you to paste the Place ID instead, with a one-line note on where to find it.
- On success the panel shows the business name, star rating, review count, when it last updated, a **Refresh now** button, and the on/off switch for showing Google reviews on the site.
- The old "search by business name / This is us" flow is removed.

**Homepage**
- The Elfsight widget is removed and the reviews section goes back to showing your Google reviews (photo, name, stars, text, link back to Google) merged with reviews left on your own site, newest first.
- If Google reviews are switched off or none have been pulled yet, only your own site reviews show — same as today.

## Technical notes

- `google-reviews-sync`: new `action: "save"` that resolves input in order — raw `ChIJ…` ID, `place_id=` / `!1s` in URL, then short-link expansion and re-check — and calls Places Details (New) `GET places/v1/places/{id}` with field mask `id,displayName,rating,userRatingCount,googleMapsUri,reviews`. No `searchText` call on this path. The `lookup` action and its text-search branch are deleted.
- Credential handling: try the request through the Lovable connector gateway; on a 403 `PERMISSION_DENIED` (which is what happens when `GOOGLE_MAPS_API_KEY` is your own Google key rather than a connector key), retry once directly against `https://places.googleapis.com` with `X-Goog-Api-Key`. That way the same code works whichever kind of key is in place, and the failing reason is surfaced verbatim if both fail.
- Details response is upserted into `google_reviews` on `review_key`, stale rows removed, and `google_place_id`, `google_place_name`, `google_rating`, `google_rating_count`, `google_maps_uri`, `google_reviews_synced_at` written to `site_settings`. Admin/`can_manage_settings` check and the 12-hour cron throttle stay as they are.
- Frontend: `GoogleReviewsSettings.tsx` rewritten around save/refresh; `src/pages/Index.tsx` reverts to `useGoogleReviews` + `combineReviews`; `src/components/ElfsightReviews.tsx` deleted.
- Edge function redeployed after the edits.
