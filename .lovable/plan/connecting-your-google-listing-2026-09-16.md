# Connecting your Google listing

## What I found

I opened your link. It points to a real listing called **BlueRiver Services**, near Renton/Kent, WA.

Two separate problems:

1. **Short links aren't understood by the search box.** The `maps.app.goo.gl` link has to be opened first to see the real address behind it. Right now the box only understands the long-form link, so pasting the short one finds nothing.
2. **Google's business search doesn't return your listing yet.** I searched Google's public business directory several ways (by name, by name plus city, and around the exact map coordinates from your link) and your business does not come back in any of them. Other "Blue River" companies do. That normally means the listing is new, not yet verified, or hidden from public business search — so even with the link fixed, Google may still have no reviews to share for it.

## What I'll change

**Short links work in the search box**
- Paste `maps.app.goo.gl/...` and the system opens it behind the scenes, reads the real business name and location, and searches Google around that exact spot.
- Also accept a Google place ID pasted directly, for cases where the search still comes up empty.
- Clearer messages: if the listing genuinely isn't in Google's business directory, say that plainly instead of "no matches", and point you to verify the business in Google Business Profile.

**If the listing still can't be found after that**
The likely cause is that the profile isn't verified/published. Two options then:
- Verify the listing with Google (your side), after which it becomes searchable and reviews flow in automatically — nothing more to build.
- Or connect Google Business Profile instead, which reads listings you own directly and gives the full review feed rather than the 5 reviews public search allows. That's a larger change: a second connection, a different sync routine, and admin sign-in with the Google account that owns the listing.

I'd try verification first, since everything is already built for it.

## Technical notes

- `supabase/functions/google-reviews-sync/index.ts`, lookup action:
  - Detect `maps.app.goo.gl` / `goo.gl/maps` input, follow redirects with a `HEAD`/`GET` (no-follow-body, short timeout), and parse the expanded URL for `!1sChI…` (a true place ID), `@lat,lng` coordinates, and the `/place/<Name>/` segment.
  - When no place ID is present (your link carries a hex CID, `!1s0x…:0x…`, which Places API New cannot resolve), fall back to `places:searchText` with `textQuery` = decoded name and `locationBias.circle` at the parsed coordinates, radius ~20km.
  - Accept a raw `ChIJ…` place ID as input and route it to Place Details.
  - Return a distinct `not_listed` result when the search succeeds but yields no match, so the panel can show the verification guidance.
- `src/components/admin/GoogleReviewsSettings.tsx`: update placeholder/help text and render the `not_listed` guidance message.
- No database or schema changes. Existing sync, cron, homepage section and review emails stay as they are.
