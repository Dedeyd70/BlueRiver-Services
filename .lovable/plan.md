

# Reorganize General Settings into Role-Appropriate Tabs

## What's wrong today

`src/components/admin/GeneralSettings.tsx` lumps **18 unrelated keys** into one "General" tab gated by a single `can_manage_settings` permission. A staff member granted that permission to (e.g.) edit business hours also gets to rewrite the homepage hero, About page mission, footer tagline, and tax rate. No separation of concerns.

Current keys in General:
- **Contact/Hours** (operational): `phone`, `phone_link`, `email`, `service_area`, `call_availability`, `business_hours_mf/sat/sun`
- **Website Content** (marketing): `footer_tagline`, `hero_headline`, `hero_subheadline`, `about_mission_title`, `about_mission_p1/p2`, `stats_clients/years/satisfaction/rating`
- **Business Rules** (sensitive): `auto_approve_bookings`, `tax_rate`

These are three distinct concerns mashed together.

## Proposed split

Break General into three permission-gated sub-areas. Pricing/Availability/Payment/Socials stay as-is.

### A. Settings → "Business Info" tab — `can_manage_settings`
Operational contact + hours that staff/managers reasonably maintain.
- `phone`, `phone_link`, `email`, `service_area`, `call_availability`
- `business_hours_mf`, `business_hours_sat`, `business_hours_sun`

### B. Settings → "Business Rules" tab — `can_manage_business_rules` *(new)*
Sensitive operational toggles that change how the system behaves.
- `auto_approve_bookings`
- `tax_rate`

### C. Move to **Website** section (sidebar) → new "Site Content" page — `can_manage_site_content` *(new)*
Marketing copy that belongs with Branding/Homepage Images/Testimonials.
- `footer_tagline`
- `hero_headline`, `hero_subheadline`
- `about_mission_title`, `about_mission_p1`, `about_mission_p2`
- `stats_clients`, `stats_years`, `stats_satisfaction`, `stats_rating`

This is a **client-side reorganization only**. The `site_settings` table keys are unchanged — every consumer (`useSiteSettings`, `Footer`, `Index`, `About`, `LocalBusinessSchema`) keeps working with zero churn.

## Implementation

### 1. `src/components/admin/GeneralSettings.tsx` → split into two
- Rename to `BusinessInfoSettings.tsx` containing only the 8 contact/hours keys.
- New `BusinessRulesSettings.tsx` containing `auto_approve_bookings` + `tax_rate`.
- Same query/mutate pattern as current; each component owns only its own keys list.

### 2. New `src/pages/admin/SiteContentAdmin.tsx`
- Standalone page (like `BrandingAdmin`, `HomepageImagesAdmin`).
- Reads/writes the 11 marketing keys above using the same `site_settings` upsert pattern.
- Gated by `can_manage_site_content` via `AdminLayout`'s existing `canAccessPath` check.

### 3. `src/pages/admin/SettingsAdmin.tsx` — update tab list
Tabs become:
| Tab | Permission |
|---|---|
| Business Info | `can_manage_settings` |
| Business Rules | `can_manage_business_rules` |
| Availability | `can_edit_availability` |
| Payment | `can_manage_payment` |
| Pricing | `can_edit_pricing` |
| Social Media | `can_manage_socials` |

### 4. `src/lib/permissions.ts`
- Add `Site Content` nav row to the **website** group, path `/admin/site-content`, permission `can_manage_site_content`.
- Extend the `__settings__` sentinel's permission list to include `can_manage_business_rules`.

### 5. `src/App.tsx`
- Register the new `/admin/site-content` route → `SiteContentAdmin`.

### 6. Migration — register new permission keys
Idempotent insert into `permission_registry`:
- `can_manage_business_rules` — "Manage Business Rules" — "Edit booking auto-approval and tax rate"
- `can_manage_site_content` — "Manage Site Content" — "Edit homepage, about, footer copy and stats"

These then auto-appear in the User Management permissions UI (which reads from the registry).

### 7. Result matrix

| Role/Permission | Sees |
|---|---|
| Staff with `can_manage_settings` only | Business Info tab only |
| Staff with `can_manage_business_rules` only | Business Rules tab only |
| Staff with `can_manage_site_content` only | "Site Content" sidebar link (no Settings link) |
| Manager (admin role) | Everything |
| Super Admin | Everything |

A staff member will no longer see footer/hero/about/stats fields unless explicitly granted `can_manage_site_content`. Tax rate and booking auto-approval are isolated behind their own toggle.

## Files Touched

| File | Change |
|---|---|
| `src/components/admin/GeneralSettings.tsx` → renamed `BusinessInfoSettings.tsx` | Keep only 8 contact/hours keys |
| `src/components/admin/BusinessRulesSettings.tsx` (new) | `auto_approve_bookings` + `tax_rate` |
| `src/pages/admin/SiteContentAdmin.tsx` (new) | 11 marketing keys, standalone page |
| `src/pages/admin/SettingsAdmin.tsx` | Replace General tab with Business Info + Business Rules |
| `src/lib/permissions.ts` | Add Site Content nav row; extend `__settings__` sentinel |
| `src/App.tsx` | Register `/admin/site-content` route |
| New migration | Insert `can_manage_business_rules` + `can_manage_site_content` into `permission_registry` |

## Untouched

`site_settings` table schema and all keys (no data migration), `useSiteSettings`, `Footer`, `Index`, `About`, `LocalBusinessSchema`, RLS policies, edge functions, all other admin pages, Pricing/Availability/Payment/Socials components.

