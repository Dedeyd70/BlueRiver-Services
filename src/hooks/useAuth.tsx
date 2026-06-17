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
  isLocked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  unlock: (password: string) => Promise<{ error: string | null }>;
}

const LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const SIGNOUT_TIMEOUT_MS = 30 * 60 * 1000;

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  role: null,
  permissions: {},
  loading: true,
  roleLoading: false,
  isLocked: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  unlock: async () => ({ error: null }),
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
  const [isLocked, setIsLocked] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const signoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLockedRef = useRef(false);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const clearTimers = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (signoutTimerRef.current) clearTimeout(signoutTimerRef.current);
  }, []);

  const doSignOut = useCallback(async () => {
    clearTimers();
    setIsLocked(false);
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setRole(null);
    setPermissions({});
  }, [clearTimers]);

  const resetTimers = useCallback(() => {
    clearTimers();
    lockTimerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, LOCK_TIMEOUT_MS);
    signoutTimerRef.current = setTimeout(() => {
      doSignOut();
    }, SIGNOUT_TIMEOUT_MS);
  }, [clearTimers, doSignOut]);

  // Idle activity listeners — only reset when not locked
  useEffect(() => {
    if (!user) return;
    const handleActivity = () => {
      if (!isLockedRef.current) resetTimers();
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    resetTimers();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [user, resetTimers, clearTimers]);

  // Bootstrap auth
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

  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsAdmin(false);
      setPermissions({});
      setRoleLoading(false);
      setIsLocked(false);
      clearTimers();
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
  }, [user?.id, refetchRole, clearTimers]);

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const channel = supabase
      .channel(`user-role-${uid}-${crypto.randomUUID()}`)
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

  const unlock = useCallback(async (password: string) => {
    if (!user?.email) return { error: "No active session" };
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error) return { error: error.message };
    setIsLocked(false);
    resetTimers();
    return { error: null };
  }, [user?.email, resetTimers]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, role, permissions, loading, roleLoading, isLocked, signIn, signOut: doSignOut, unlock }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
