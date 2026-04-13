

# Phase 1, Task 1.1 — Remove "Admin" Link from Footer

## What will change
- **File:** `src/components/Footer.tsx`
- **Change:** Remove the `["Admin", "/admin/login"]` entry from the Quick Links array (around line 45)

## What will NOT change
- No logic, styling, layout, or database changes
- All other footer links remain intact

## What to test after implementation
- Visit the homepage and scroll to the footer
- Confirm "Admin" no longer appears in Quick Links
- Confirm all other links (Home, About Us, Services, Gallery, Book Now, Request a Quote) still work
- Admins can still access `/admin/login` by typing the URL directly

## Risk
Zero — purely cosmetic removal of one link.

