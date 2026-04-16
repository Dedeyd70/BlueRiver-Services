# Loading, Freezing & Redundancy Sweep

## Root Causes Identified

### 1. Nested `<Routes>` Causing Initial Render Freeze

**This is the primary cause of "pages only load after refresh."**

In `App.tsx` (lines 89-113), public routes are wrapped in a catch-all `path="*"` route that renders **another nested `<Routes>**` inside it. This is a React Router anti-pattern — the inner `<Routes>` doesn't resolve on the first render cycle because the outer catch-all matches everything including `/admin/*`. On refresh, the browser URL is already set so it resolves correctly.

**Fix:** Flatten all routes into a single `<Routes>` block. Use a `<Layout>` wrapper component (Navbar + Footer) for public routes instead of nesting.

### 3. Six Duplicate Service Queries

The `services` table is queried with 6 different query keys across pages, all fetching nearly identical data:

- `public-services` (Services.tsx)
- `public-services-home-all` (Index.tsx)
- `public-services-booking-all` (BookService.tsx)
- `public-services-quote-all` (RequestQuote.tsx)
- `public-services-gallery` (Gallery.tsx — only needs `title`)
- `public-services-footer` (Footer.tsx — only needs `title`, limit 4)

**Fix:** Create a shared `useServices()` hook with a single query key. Pages that need subsets (main vs addon, titles only) derive from the cached full list.

### 4. `useSiteSettings()` Called 6+ Times Per Page Load

Called in: Index, Contact, BookService, About, Footer, LocalBusinessSchema. Each call is the same query key so React Query deduplicates, but the hook is imported and invoked redundantly. This is low-impact since React Query caches it, but the repeated imports add bundle weight.

**Fix:** No action needed — React Query handles deduplication. This is acceptable.

### 5. QueryClient Has No Default Config

`const queryClient = new QueryClient()` on line 48 of `App.tsx` has no `staleTime` or `retry` defaults. Every query refetches on every mount/focus by default (staleTime = 0). This causes unnecessary network requests on every navigation.

**Fix:** Set `defaultOptions.queries.staleTime` to 5 minutes and `refetchOnWindowFocus` to false.

### 6. Gallery Page Has No Loading State

`Gallery.tsx` doesn't check `isLoading` — it renders empty content while data loads, causing a flash of empty content.

### 7. About Page Has No Loading State

`About.tsx` doesn't show any loading indicator while settings/branding load.

---

## Implementation Plan

### Step 1 — Fix the nested Routes (freeze fix)

**File: `src/App.tsx**`

- Create a `PublicLayout` component that renders `<Navbar />`, `<main><Outlet /></main>`, `<Footer />`
- Replace the nested `<Routes>` with a flat structure:

```text
<Routes>
  {/* Admin */}
  <Route path="/admin/login" ... />
  <Route path="/admin/reset-password" ... />
  <Route path="/admin" element={<AdminLayout />}> ... </Route>
  
  {/* Public */}
  <Route element={<PublicLayout />}>
    <Route path="/" element={<Index />} />
    <Route path="/about" ... />
    ...
    <Route path="*" element={<NotFound />} />
  </Route>
</Routes>
```



### Step 3 — Add QueryClient defaults

**File: `src/App.tsx**`

- Configure `new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 } } })`

### Step 4 — Create shared `useServices` hook

**New file: `src/hooks/useServices.ts**`

- Single query key `["public-services"]`, fetches `select("*").eq("is_active", true).order("display_order")`
- Export `useServices()` returning `{ services, mainServices, addons, isLoading }`
- Update `Index.tsx`, `Services.tsx`, `BookService.tsx`, `RequestQuote.tsx`, `Gallery.tsx`, `Footer.tsx` to use it

### Step 5 — Add loading states to Gallery and About

**Files: `src/pages/Gallery.tsx`, `src/pages/About.tsx**`

- Add `isLoading` checks with `<Skeleton>` components

### Summary Table


| Change                  | Files                  | Impact                      |
| ----------------------- | ---------------------- | --------------------------- |
| Flatten nested Routes   | App.tsx                | Fixes freeze/refresh bug    |
| &nbsp;                  | &nbsp;                 | &nbsp;                      |
| QueryClient defaults    | App.tsx                | Reduces redundant fetches   |
| Shared useServices hook | New hook + 6 pages     | Removes 5 duplicate queries |
| Gallery/About skeletons | Gallery.tsx, About.tsx | Eliminates empty flashes    |


**Total: ~8 files modified, 1 new hook file**