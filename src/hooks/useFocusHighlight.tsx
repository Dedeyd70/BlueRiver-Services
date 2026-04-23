import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Reads the `?focus=<id>` query param and returns:
 * - `focusId` — the id (or null)
 * - `getRef(id)` — call inside each item; returns a ref to attach to the row container.
 *
 * After the matching element mounts (and `ready` becomes true), we scroll it into
 * view and apply a temporary ring highlight (~3 s).
 */
export function useFocusHighlight(ready: boolean = true) {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");
  const refs = useRef<Map<string, HTMLElement | null>>(new Map());
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!focusId || !ready) return;
    if (handled.current === focusId) return;
    const el = refs.current.get(focusId);
    if (!el) return;
    handled.current = focusId;
    // Defer slightly so layout is settled
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "transition-shadow");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background");
      }, 3000);
    }, 150);
    return () => clearTimeout(t);
  }, [focusId, ready]);

  const getRef = (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };

  return { focusId, getRef };
}
