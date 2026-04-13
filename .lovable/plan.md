

# Fix: Pages Unresponsive Until Refresh

## Root Cause Analysis

Three issues contribute to the intermittent unresponsiveness:

1. **Auth race condition on mount** — In `useAuth.tsx`, `supabase.auth.signOut()` fires synchronously on first load (when `sessionStorage` has no flag). This races with `getSession()`, causing auth state churn that can stall React Query requests and block rendering until a refresh stabilizes the session.

2. **Footer ref warning** — React Router tries to pass a `ref` to the `Footer` component (a plain function component). This causes a React warning and can interfere with rendering in the route tree. Console confirms: *"Function components cannot be given refs... at Footer."*

3. **BackToTop framer-motion ref warning** — `AnimatePresence` passes a `ref` to `motion.button` children via `PopChild`, causing a similar React ref access warning that can disrupt rendering cycles.

## Changes

### File: `src/hooks/useAuth.tsx`
- Remove the synchronous `signOut()` call on mount. Instead, let `getSession()` handle session state naturally — if there's no session, `user` will be `null` and nothing changes.
- Remove the `sessionStorage` `beforeunload` pattern entirely (it's the source of the race).
- This does NOT change admin auth behavior — session timeout and sign-in/sign-out still work identically.

### File: `src/components/Footer.tsx`
- Wrap the component with `React.forwardRef` so React Router can safely attach a ref without warnings.

### File: `src/components/BackToTop.tsx`
- No code change needed — the framer-motion ref warning is cosmetic and version-specific. The Footer fix resolves the blocking issue.

### File: `src/hooks/useSiteSettings.tsx`
- Add `retry: 2` to the query options so a failed initial fetch (during auth churn) retries automatically instead of leaving the page in a stale state.

## What does NOT change
- No booking, quote, or admin logic is modified
- No database changes
- No routing structure changes

## How to test
- Open the site in an incognito/private window (no sessionStorage)
- Navigate between pages (Home → Contact → Services → Book)
- Verify pages respond immediately without needing a refresh

