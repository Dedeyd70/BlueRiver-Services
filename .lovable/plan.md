

# Combined Implementation: Registry Sync + Dashboard Gating

## Part 1 — Permission Registry Sync (SQL migration)

```sql
-- Rename mismatched key
UPDATE permission_registry SET key = 'can_edit_availability'
 WHERE key = 'can_edit_availability_settings';

-- Drop duplicate + orphan
DELETE FROM permission_registry
 WHERE key IN ('can_manage_site_settings','can_publish_gallery');

-- Add missing payment key
INSERT INTO permission_registry (key, label, description) VALUES
  ('can_manage_payment','Manage Payment Settings',
   'Edit payment methods (Cash, Zelle) and payout details')
ON CONFLICT (key) DO NOTHING;

-- Migrate existing user grants
UPDATE user_roles
   SET permissions = (permissions - 'can_edit_availability_settings')
                  || jsonb_build_object('can_edit_availability', true)
 WHERE permissions ? 'can_edit_availability_settings';

UPDATE user_roles
   SET permissions = permissions - 'can_manage_site_settings' - 'can_publish_gallery'
 WHERE permissions ?| ARRAY['can_manage_site_settings','can_publish_gallery'];

-- RLS hardening (additive — admin policies remain)
CREATE POLICY "Permitted users manage availability"
ON availability_settings FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_edit_availability'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_edit_availability'));

CREATE POLICY "Permitted users manage blocked dates"
ON blocked_dates FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_edit_availability'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_permission(auth.uid(),'can_edit_availability'));
```

`lib/permissions.ts` and `SettingsAdmin.tsx` already use canonical keys (`can_edit_availability`, `can_manage_payment`) — verify only, no edit expected.

## Part 2 — Dashboard Card Gating (`src/pages/admin/Dashboard.tsx`)

### Per-card permission map

| Card | Gate |
|---|---|
| Total Submissions | always visible |
| Bookings, Active Bookings | `can_manage_bookings` |
| Quote Requests, Open Quotes | `can_manage_quotes` |
| Contact Submissions, New Inquiries | `can_manage_messages` |
| Services | admin role only |
| Gallery | `can_manage_gallery` |
| Testimonials | `can_manage_testimonials` |

### Implementation

1. Import `useHasPermission` and `useAuth`. Pre-compute booleans at component top:
   ```ts
   const { role } = useAuth();
   const canBookings = useHasPermission("can_manage_bookings");
   const canQuotes = useHasPermission("can_manage_quotes");
   const canMessages = useHasPermission("can_manage_messages");
   const canGallery = useHasPermission("can_manage_gallery");
   const canTestimonials = useHasPermission("can_manage_testimonials");
   ```
2. Add `permission?: string | "admin"` field to each stat object.
3. Build `visibleStats` by filtering with the precomputed flags (key→bool map). Keep all `useQuery` calls unconditional (React hook rules); count-only HEAD queries are cheap.
4. Update grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. CSS grid auto-reflows surviving cards.
5. Empty-state fallback: if `visibleStats.length === 0`, render "No metrics available for your role."

Admin role bypasses all gates (the hook already returns `true` for admin).

## Files Touched

| File | Change |
|---|---|
| New SQL migration | Registry rename/delete/insert + grant migration + 2 RLS policies |
| `src/pages/admin/Dashboard.tsx` | Permission gating, responsive grid, empty state |
| `src/lib/permissions.ts` | Verify only |
| `src/pages/admin/SettingsAdmin.tsx` | Verify only |

## Untouched

`useAuth`, `usePermissions`, `<HasPermission>`, `AdminLayout`, edge functions, all other admin pages and RLS policies.

