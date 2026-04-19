

# Fix Dashboard Counters + Extend Permission-Gated RLS

## Migration (one transaction)

```sql
-- 1. Seed all operational permission keys
INSERT INTO public.permission_registry (key, label, description) VALUES
  ('can_manage_bookings',    'Manage Bookings',    'View and manage bookings'),
  ('can_manage_quotes',      'Manage Quotes',      'View and manage quote requests'),
  ('can_manage_messages',    'Manage Messages',    'View and manage contact submissions'),
  ('can_manage_settings',    'Manage Settings',    'View and manage site settings'),
  ('can_manage_gallery',     'Manage Gallery',     'View and manage gallery images'),
  ('can_manage_testimonials','Manage Testimonials','View and manage testimonials')
ON CONFLICT (key) DO NOTHING;

-- 2. Permission-aware RLS (admin OR has_permission). Existing admin-only policies stay.

-- bookings (SELECT)
CREATE POLICY "Permitted users can view bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_bookings'));

-- contact_submissions (SELECT)
CREATE POLICY "Permitted users can view contact_submissions"
  ON public.contact_submissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_messages'));

-- site_settings (ALL — read + write needed for settings UI)
CREATE POLICY "Permitted users can manage site_settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_settings'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_settings'));

-- gallery (ALL)
CREATE POLICY "Permitted users can manage gallery"
  ON public.gallery FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_gallery'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_gallery'));

-- testimonials (ALL)
CREATE POLICY "Permitted users can manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_testimonials'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'can_manage_testimonials'));

-- 3. Realtime publication for dashboard reactivity
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_submissions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.bookings            REPLICA IDENTITY FULL;
ALTER TABLE public.quote_requests      REPLICA IDENTITY FULL;
ALTER TABLE public.contact_submissions REPLICA IDENTITY FULL;
```

## `src/pages/admin/Dashboard.tsx` changes

Confirmed actual statuses: `bookings` uses `pending|confirmed|completed|cancelled`; `quote_requests` uses `requested|in_progress|converted|closed`; `contact_submissions` uses `pending|read|responded|converted`.

- **"Pending Bookings"** → label **"Active Bookings"**, query `.in("status", ["pending","confirmed"])`, path `/admin/bookings?status=active`
- **"Pending Quotes"** → label **"Open Quotes"**, query `.in("status", ["requested","in_progress"])`, path `/admin/quotes?status=open`
- **"New Inquiries"** unchanged (matches `pending`)
- Add realtime subscription invalidating the relevant React Query keys on any change to the three tables

```tsx
useEffect(() => {
  const ch = supabase.channel("dashboard-stats")
    .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings-count"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-grand-total"] });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "quote_requests" }, () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes-count"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-quotes-count"] });
      qc.invalidateQueries({ queryKey: ["admin-grand-total"] });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "contact_submissions" }, () => {
      qc.invalidateQueries({ queryKey: ["admin-submissions-count"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
      qc.invalidateQueries({ queryKey: ["admin-grand-total"] });
    })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [qc]);
```

## Files Touched

| File | Change |
|---|---|
| New migration | Seed 6 permission keys; permission-OR-admin RLS on `bookings`, `contact_submissions`, `site_settings`, `gallery`, `testimonials`; realtime publication + REPLICA IDENTITY |
| `src/pages/admin/Dashboard.tsx` | Correct status filters, rename labels, add realtime subscription |

## Untouched

`NotificationBell`, list pages, `useAuth`, social links, existing admin RLS (additive), public submission flows.

