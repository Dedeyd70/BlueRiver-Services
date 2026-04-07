import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/permissions";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  role: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const checkRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      return (data?.role as AppRole) ?? null;
    } catch {
      return null;
    }
  }, []);

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

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("blueriver_session_active", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    const wasActive = sessionStorage.getItem("blueriver_session_active");
    if (!wasActive) {
      supabase.auth.signOut();
    }
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const r = await checkRole(u.id);
        setRole(r);
        setIsAdmin(r === "admin" || r === "manager" || r === "staff");
      }
      setLoading(false);
      initialised.current = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialised.current) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const r = await checkRole(u.id);
        setRole(r);
        setIsAdmin(r === "admin" || r === "manager" || r === "staff");
      } else {
        setIsAdmin(false);
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    sessionStorage.setItem("blueriver_session_active", "true");
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, role, loading, signIn, signOut: doSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
