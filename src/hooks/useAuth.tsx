import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/permissions";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  role: AppRole | null;
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
  loading: true,
  roleLoading: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const doSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setRole(null);
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

  // Resolve role separately — does NOT block `loading`.
  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    let cancelled = false;
    setRoleLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const r = (data?.role as AppRole) ?? null;
        setRole(r);
        setIsAdmin(r === "admin" || r === "manager" || r === "staff");
        setRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, role, loading, roleLoading, signIn, signOut: doSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
