
# Implementation Plan (approved)

## 1. Submissions deep-link router
`src/pages/admin/Submissions.tsx`: change "Open" link from `/admin/bookings` to `/admin/bookings?focus={id}` (and quotes/messages equivalents). The target pages already use `useFocusHighlight` (scroll + ring). They will additionally seed the local `expandedId` from `?focus=` so the card opens automatically.

## 2. Permission UX
- New `src/components/PermissionGate.tsx`: wraps a child element. If user lacks the permission, the child is rendered `disabled` with a tooltip "Requires '{label}' permission." (label pulled from `permission_registry`). Admin always passes through. Mode `hide` keeps current behaviour for sidebar-style cases.
- Replace `<HasPermission>` around inline action rows in `BookingsAdmin`, `QuotesAdmin`, `MessagesAdmin`, `InvoicesAdmin` with the new gate (visible-but-disabled).
- Sidebar siloing: add `can_manage_invoices` permission entry to `NAV_PERMISSIONS` in `src/lib/permissions.ts` so users without invoice perms don't see the tab.
- `UserManagement.tsx`: group permission switches by module with a "Grant all {module}" master toggle. Permissions stay independent.
- New `src/lib/friendlyRpcError.ts`: maps `NOT_AUTHORIZED:*` exceptions thrown by RPCs to a clean toast message.

## 3. Collapsible "summary-first" cards + 10/page pagination
- New `src/components/admin/CollapsibleRecordCard.tsx` (built on existing `@/components/ui/collapsible`): shows 4 summary fields (name / date / service / status). Click expands full details + actions.
- New `src/components/admin/Paginator.tsx`: prev/next + page count, default page size 10.
- Refactor row renderers in Bookings, Quotes, Messages, Submissions, Invoices to use both. Auto-expand when `useFocusHighlight` matches.

## 4. Active / Archive tabs
- Bookings: archive only when `cancelled` OR (`completed` AND linked invoice `payment_status='paid'`). Otherwise stays Active.
- Quotes: Active = `requested|in_progress`; Archive = `converted|closed`.
- Messages: Active = `pending|read`; Archive = `responded|converted`.
- Archive cards render with `readOnly` flag → action buttons hidden or disabled with tooltip "Archived record — actions disabled."

## 5. Operational fixes
### 5a. Always Pending
- `BookService.tsx` line 249: drop `auto_approve_bookings`, always `status:'pending'`.
- `QuotesAdmin.tsx` convert flow: drop `autoApprove` lookup, hardcode `status:'pending'`.

### 5b. Reschedule
Add Reschedule button + dialog in `BookingsAdmin` (date + time, reuses `get_booked_slots` for collision avoidance, logs `rescheduled` activity). Permission-gated by `can_manage_bookings`.

### 5c. RPC patches (priority — fixes 400/403)
One migration:
- `convert_quote_to_booking`: rewritten to read snapshot (line_items, subtotal, tax, total) from `quote_drafts` (real source — `quote_requests` has no such columns). Hardcodes `status='pending'` and `source='quote'`. Adds `SECURITY DEFINER`, `SET search_path = public`, and a permission gate that raises `'NOT_AUTHORIZED: You need Manage Quotes permission to convert this quote.'`.
- `create_invoice_from_booking`: add `SECURITY DEFINER`, `SET search_path = public`, permission gate on `can_manage_invoices`.
- `mark_invoice_paid`: same hardening.
- Insert `can_manage_invoices` into `permission_registry` (idempotent).

## 6. Cleanup
- Remove any direct `bookings.insert` / `invoices.insert` paths still left.
- Confirm `InvoicesAdmin.applyPayment` only patches metadata then calls RPC.
- Invalidate `["admin-receipts"]` after `mark_invoice_paid` succeeds.

No table schema changes. No RLS changes. No drops.
