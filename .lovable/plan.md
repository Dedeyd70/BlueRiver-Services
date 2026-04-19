

# Dual-Timer Idle Lock + Password Visibility Toggles

## Approach

Two staged timers protect the admin session: **10 min → lock** (blurred overlay, password to resume), **30 min → full sign-out** (back to login). Plus password visibility toggles on Lock Screen and Login.

## 1. `src/hooks/useAuth.tsx` — dual-timer state machine

- Constants: `LOCK_TIMEOUT_MS = 10 * 60 * 1000`, `SIGNOUT_TIMEOUT_MS = 30 * 60 * 1000`.
- New state: `isLocked: boolean`.
- Two refs: `lockTimerRef`, `signoutTimerRef`.
- `resetTimers()` (replaces `resetTimeout`):
  - Clears both timers.
  - Schedules lock timer → `setIsLocked(true)` at 10 min.
  - Schedules signout timer → `doSignOut()` at 30 min.
- Idle event listeners reset timers **only when `!isLocked`** (locked screen must not extend the 30-min signout).
- While locked, the 30-min signout timer keeps running from when the lock fired — guarantees full logout at 30 min total even if user never comes back.
- New method `unlock(password)`:
  - `supabase.auth.signInWithPassword({ email: user.email, password })`.
  - On success → `setIsLocked(false)` + `resetTimers()`.
  - On failure → return error string; remain locked.
- Expose `isLocked`, `unlock` via `AuthContext`.
- Clear both timers on `doSignOut()` and on user becoming null.

## 2. New `src/components/admin/SessionLockOverlay.tsx`

Full-screen `fixed inset-0 z-[100] backdrop-blur-md bg-background/80 flex items-center justify-center`:
- Lock icon, heading "Session Locked"
- Body: "Signed in as **{user.email}**"
- Password input with **Eye/EyeOff toggle button** (right-aligned inside input wrapper)
- "Unlock" primary button → `unlock()`, toast on error, clear field
- "Sign out" ghost button → `signOut()` (lets a different person take over)
- `Esc` does nothing; no close button — overlay is unbypassable while `isLocked`

## 3. `src/pages/admin/AdminLayout.tsx` — mount overlay

- Read `isLocked` from `useAuth`.
- When `isLocked && user`, render `<SessionLockOverlay />` on top of the existing layout (dashboard stays mounted underneath, preserving form/scroll state).

## 4. `src/pages/admin/Login.tsx` — active-session panel + Eye toggle

- **If `user && isAdmin && !isLocked`** → render panel:
  - "You are currently signed in as **{user.email}** ({role label})"
  - Primary: "Continue to Dashboard" → `navigate("/admin")`
  - Ghost: "Switch Account" → `await signOut()` then show login form
- **If no user** → existing form, with password input now wrapped to include **Eye/EyeOff toggle button**.
- **If locked** → still render panel; "Continue to Dashboard" lands on the lock overlay (correct behavior).
- Remove the silent auto-redirect `useEffect`.

## 5. Reusable password-with-toggle pattern

Since both Login and SessionLockOverlay need it, implement inline (Input + absolute-positioned button with `Eye`/`EyeOff` lucide icon, toggling `type` between `password` and `text`). No new shared component to keep diff small — same ~10 lines in two places.

## 6. No backend changes

RLS, edge functions, registry untouched. `signInWithPassword` already exists; reusing it for unlock is safe (it refreshes the session JWT, which is desirable).

## Files Touched

| File | Change |
|---|---|
| `src/hooks/useAuth.tsx` | Dual timers (10 min lock / 30 min signout), `isLocked` state, `unlock()` method |
| `src/components/admin/SessionLockOverlay.tsx` | New: blurred full-screen lock UI with Eye-toggle password + Sign out |
| `src/pages/admin/AdminLayout.tsx` | Mount `<SessionLockOverlay />` when `isLocked` |
| `src/pages/admin/Login.tsx` | Active-session panel, Eye/EyeOff toggle on password, remove silent redirect |

## Untouched

RLS, edge functions, `usePermissions`, `<HasPermission>`, all other admin pages, `signIn`/`signOut` core, permissions registry.

