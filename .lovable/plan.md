
## Goal

Fix the two reported bugs (admin "New Request" emails not arriving, "Mark as Paid" RLS error) and ship the requested permission overhaul + Team Management UI in a single pass.

---

## 1. Permission Bundles (Functional Roles)

Introduce four bundle keys in `permission_registry` and a helper that expands a bundle into the granular `permissions` JSONB the rest of the app already consumes. Granular keys stay (no breaking change), bundles are syntactic sugar.

Bundles:
- **operations** → `can_manage_bookings`, `can_manage_quotes`, `can_manage_messages`, `can_edit_availability`
- **finance** → `can_manage_invoices`, `can_manage_payment`, `can_edit_pricing`
- **content** → `can_manage_gallery`, `can_manage_testimonials`, `can_manage_site_content`, `can_manage_legal`, `can_manage_settings` (FAQs/Areas live behind this)
- **system_admin** → `can_manage_business_rules`, `can_manage_socials`, plus full operations + finance + content

Implementation:
- Migration: insert 4 rows into `permission_registry` (`bundle.operations`, etc.) with descriptions.
- New file `src/lib/permissionBundles.ts` exports `BUNDLES` map + `applyBundle(perms, bundle, on)` and `getBundleState(perms)` so the UI can show toggles without changing the storage shape.
- `useHasPermission` is unchanged — code keeps reading granular keys.

## 2. confirm_invoice_payment RPC (fixes RLS error)

Root cause: `applyPayment` does `update(...).select("id").maybeSingle()` then throws `"Update blocked by permissions or RLS"` when `data` is null. Staff with only `can_manage_invoices` cannot UPDATE because the existing `invoices` UPDATE policy requires role admin/manager only, not the permission key. Frontend also writes `payment_status='partial'` directly which is what trips RLS for non-admins.

Fix:

```sql
CREATE OR REPLACE FUNCTION public.confirm_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_payment_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  inv invoices%ROWTYPE;
  v_new_paid numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHORIZED: Sign in required.'; END IF;
  IF NOT (has_role(auth.uid(),'admin'::app_role)
       OR has_permission(auth.uid(),'can_manage_invoices')
       OR has_permission(auth.uid(),'can_manage_payment')
       OR has_permission(auth.uid(),'can_manage_bookings')) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: You need Finance or Operations permission to record payments.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;

  SELECT * INTO inv FROM invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;

  v_new_paid := round(coalesce(inv.amount_paid,0) + p_amount, 2);
  v_status := CASE WHEN v_new_paid >= inv.total_amount THEN 'paid'
                   WHEN v_new_paid > 0 THEN 'partial'
                   ELSE 'unpaid' END;

  UPDATE invoices SET
    amount_paid = v_new_paid,
    payment_method = p_method,
    payment_date = p_payment_date,
    payment_reference = p_reference,
    payment_status = v_status,
    paid_at = CASE WHEN v_status='paid' THEN now() ELSE paid_at END,
    updated_at = now()
  WHERE id = p_invoice_id;

  IF v_status = 'paid' THEN PERFORM public.create_receipt(p_invoice_id); END IF;

  RETURN jsonb_build_object('id', p_invoice_id, 'status', v_status, 'amount_paid', v_new_paid);
END $$;
```

Also add an RLS policy `Operations can view linked invoices` on `invoices` so users with `can_manage_bookings` can SELECT invoices (read-only) — needed for booking detail screens to display invoice status.

`InvoicesAdmin.tsx` `applyPayment` is replaced with a single `supabase.rpc('confirm_invoice_payment', {...})` call. The two-step UPDATE + `mark_invoice_paid` is removed.

## 3. Reliable Admin Notifications

The frontend code in `BookService.tsx`, `RequestQuote.tsx`, `Contact.tsx` already issues two `send-transactional-email` calls (customer + admin). The edge function already hardcodes `ADMIN_INBOX = "info@blueriverservices.co"` for `admin_new_submission`. Audit found these are correct but use `.catch` only — silent failures. Hardening:

- Add `await Promise.allSettled([...])` so the network error surfaces in console with explicit `[admin-email]` tag.
- Edge function: log a single line `console.log("admin alert ->", recipient, kind)` so we can verify in `edge_function_logs`.
- Verify in the BookingsAdmin confirm flow it also fires `admin_new_submission` only for new entries, not status changes (already correct — leave alone).

No other behavioral change needed; the bug report is most likely a Resend deliverability issue (spam folder). After the patch we will pull `edge_function_logs` to confirm 200 responses for admin sends.

## 4. Team Management UI

New tab in `SettingsAdmin.tsx` → `Team Management` (admin-only). Component `src/components/admin/TeamManagementSettings.tsx`:

- Calls existing `list-admin-users` edge function to load users.
- Per row: shows email, role, and 4 bundle switches (Operations / Finance / Content / System Admin).
- Toggling a bundle calls a new edge function `update-user-permissions` (or reuses existing user-permissions update path) that merges granular keys via `applyBundle`. We will use direct Supabase update on `user_roles.permissions` (admin-gated by RLS already).
- Read-only badge for current role (admin/manager/staff/user).

## 5. Verification Step

Migration includes:
```sql
UPDATE public.user_roles
SET permissions = permissions
  || '{"can_manage_invoices":true,"can_manage_payment":true,"can_edit_pricing":true}'::jsonb
WHERE user_id = (SELECT id FROM auth.users WHERE email='joshuaquao@gmail.com');
```
(joshuaquao is already `admin` so this is belt-and-suspenders; ensures any future role downgrade still keeps Finance.)

After deploy, call `confirm_invoice_payment` with a test invoice via SQL to prove it works.

---

## Files Changed

- **NEW** `supabase/migrations/<ts>_permission_bundles_and_payment_rpc.sql`
- **NEW** `src/lib/permissionBundles.ts`
- **NEW** `src/components/admin/TeamManagementSettings.tsx`
- `src/pages/admin/InvoicesAdmin.tsx` — replace `applyPayment` with RPC call
- `src/pages/admin/SettingsAdmin.tsx` — add Team Management tab (admin only)
- `src/pages/BookService.tsx`, `src/pages/RequestQuote.tsx`, `src/pages/Contact.tsx` — wrap two email calls in `Promise.allSettled` with `[admin-email]` logging
- `supabase/functions/send-transactional-email/index.ts` — add admin-route log line
- Deploy `send-transactional-email`

## Out of Scope
No changes to existing granular permission keys, no removal of `mark_invoice_paid` (kept for backwards compat / receipt creation path).
