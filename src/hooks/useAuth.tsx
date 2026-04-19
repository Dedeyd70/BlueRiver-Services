import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/permissions";

type PermissionsMap = Record<string, boolean>;

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  role: AppRole | null;
  permissions: PermissionsMap;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  role: null,
  permissions: {},
  loading: true,
  roleLoading: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

const normalizePermissions = (raw: unknown): PermissionsMap =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as PermissionsMap) : {};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const doSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setRole(null);
    setPermissions({});
  }, []);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      doSignOut();
    }, SESSION_TIMEOUT_MS);
  }, [doSignOut]);

  // Idle session timeout
  useEffect(() => {
    if (!user) return;
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimeout, { passive: true }));
    resetTimeout();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimeout));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, resetTimeout]);

  // Bootstrap: register listener FIRST, then getSession() as backup.
  // Set user synchronously inside the listener — never await before setUser.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Stable refetch — used by initial load, focus/visibility, and as fallback.
  const refetchRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, permissions")
      .eq("user_id", userId)
      .maybeSingle();
    const r = (data?.role as AppRole) ?? null;
    setRole(r);
    setIsAdmin(r === "admin" || r === "manager" || r === "staff");
    setPermissions(normalizePermissions((data as { permissions?: unknown } | null)?.permissions));
  }, []);

  // Initial role/permissions resolution — does NOT block `loading`.
  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsAdmin(false);
      setPermissions({});
      setRoleLoading(false);
      return;
    }
    let cancelled = false;
    setRoleLoading(true);
    refetchRole(user.id).finally(() => {
      if (!cancelled) setRoleLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, refetchRole]);

  // Live permission sync: realtime UPDATE on this user's row + focus/visibility refetch fallback.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const channel = supabase
      .channel(`user-role-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as { role?: AppRole; permissions?: unknown } | null;
          const r = (row?.role as AppRole) ?? null;
          if (r) {
            setRole(r);
            setIsAdmin(r === "admin" || r === "manager" || r === "staff");
          }
          setPermissions(normalizePermissions(row?.permissions));
        }
      )
      .subscribe();

    const handleRefetch = () => {
      if (document.visibilityState === "visible") refetchRole(uid);
    };
    const handleFocus = () => refetchRole(uid);

    document.addEventListener("visibilitychange", handleRefetch);
    window.addEventListener("focus", handleFocus);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleRefetch);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user?.id, refetchRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, role, permissions, loading, roleLoading, signIn, signOut: doSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
