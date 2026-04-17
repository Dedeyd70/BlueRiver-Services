

# Auth & Initial Loading Refactor

Scope: `src/hooks/useAuth.tsx`, `src/App.tsx`, `src/pages/admin/AdminLayout.tsx` only.

---

## 1. `src/hooks/useAuth.tsx` — rewrite the bootstrap sequence

**What changes**

- Register `onAuthStateChange` **first**, then call `getSession()` (Supabase's recommended order).
- Remove the `initialised.current` guard that swallows the `INITIAL_SESSION` event. The handler will process every event including the first one.
- Inside the listener, set `user` **synchronously** from the session. Do **not** `await` anything before `setUser`.
- Move `checkRole()` into a **separate, non-blocking** effect keyed on `user?.id`. Role resolution no longer gates `loading`.
- `setLoading(false)` is called as soon as the session check resolves (with or without a user) — it no longer waits for the role round-trip.
- Add a new derived flag `roleLoading` for components that specifically need to wait for role data, but `loading` (auth-known) flips to `false` after one round-trip, not two.
- Keep the 30-min idle timeout logic untouched.

**Why this fixes the refresh issue**

- `INITIAL_SESSION` is no longer dropped, so on cold load the user state is populated from the very first event Supabase emits — usually within ~10ms of mount, before `getSession()` even resolves.
- `loading` no longer waits on `user_roles`. Pages that don't need role data unblock ~100–200ms sooner.
- Synchronous `setUser` inside the listener means React Query observers that depend on `user` re-run immediately on the next render, not after two awaited network calls.

**High-level flow**

```text
mount
 ├─ register onAuthStateChange listener
 │    └─ on every event (incl. INITIAL_SESSION):
 │         setUser(session?.user ?? null)   ← synchronous
 │         setLoading(false)
 └─ getSession()  (backup, also calls setUser + setLoading(false))

separate effect [user?.id]:
 └─ checkRole() → setRole, setIsAdmin   (non-blocking, independent)
```

---

## 2. `src/App.tsx` — provider order + non-blocking root

**What changes**

- No structural changes to routes.
- Confirm provider order: `QueryClientProvider` → `AuthProvider` → `TooltipProvider` → `BrowserRouter`. (Already correct; no edit needed unless ordering is off.)
- No top-level `loading` gate is added — public pages must render immediately.
- The existing `QueryClient` defaults (`staleTime: 5min`, `refetchOnWindowFocus: false`, `retry: 1`) stay as-is.

**Why this fixes the refresh issue**

- Confirms there is no root-level blocker. Public pages mount and fetch their (anon-accessible) data in parallel with auth resolution, which is safe because public queries don't depend on session.
- Likely **no code change** here once `useAuth` is fixed; this file is included in scope only to verify nothing blocks the tree.

---

## 3. `src/pages/admin/AdminLayout.tsx` — smarter gating

**What changes**

- Replace the single `if (loading) return <Loading/>` gate with a more precise guard:
  - While `loading` is true → show the loader (auth state genuinely unknown).
  - Once `loading` is false and `user` exists but `role` is still resolving → render the admin shell (sidebar + outlet) but let individual admin pages handle their own data-loading skeletons. Role-gated nav items can show a small inline skeleton.
  - Once `loading` is false and there is no `user` → redirect to `/admin/login` (existing behavior).
- The `canAccessPath` check stays, but only runs once `role` is known (skip when `role === null && user` because role is still loading).
- Remove the redirect-flash by ensuring the `useEffect` that calls `navigate("/admin/login")` only fires when `loading === false` **and** `user === null` (already the case, but reconfirm now that `loading` flips faster).

**Why this fixes the refresh issue**

- Eliminates the "bounce to login then bounce back" flash on cold load: because `INITIAL_SESSION` is now processed, `user` is populated before the first redirect effect runs.
- Admin pages start mounting (and firing their queries) earlier, so the perceived load time drops noticeably.
- Role-checking no longer gates the entire admin shell — only the specific nav items / routes that depend on role.

**High-level flow**

```text
render():
  if (loading)                       → <Loading/>
  if (!user)                         → redirect /admin/login
  if (user && !role)                 → render shell, mark nav as "loading roles"
  if (user && role && !canAccess)    → redirect /admin
  else                               → render shell + outlet
```

---

## Summary

| File | Change | Effect |
|------|--------|--------|
| `useAuth.tsx` | Reorder listener-before-getSession; drop INITIAL_SESSION guard; split role into non-blocking effect | Auth state populated on first event; `loading` resolves after 1 round-trip not 2 |
| `App.tsx` | Verify provider order; no blocking root gate | Public pages render in parallel with auth |
| `AdminLayout.tsx` | Tiered gate (loading → user → role); no flash redirect | Admin pages mount sooner, no login bounce |

Outcome: the cold-load race window collapses. First visit behaves the same as a refresh because `INITIAL_SESSION` is honored and the loading flag no longer waits on a second sequential network call.

