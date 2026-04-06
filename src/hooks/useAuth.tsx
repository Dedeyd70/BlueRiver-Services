import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const checkAdmin = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }, []);

  const doSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  }, []);

  // Session timeout: reset timer on activity
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      doSignOut();
    }, SESSION_TIMEOUT_MS);
  }, [doSignOut]);

  // Logout on browser/tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Mark session for cleanup - use sessionStorage flag
      sessionStorage.setItem("blueriver_session_active", "true");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Check if returning from a page reload vs new tab
    const wasActive = sessionStorage.getItem("blueriver_session_active");
    if (!wasActive) {
      // New tab/window - sign out any lingering session
      supabase.auth.signOut();
    }

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Activity listeners for session timeout
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
        const admin = await checkAdmin(u.id);
        setIsAdmin(admin);
      }
      setLoading(false);
      initialised.current = true;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!initialised.current) return;
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const admin = await checkAdmin(u.id);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    sessionStorage.setItem("blueriver_session_active", "true");
    return { error: null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut: doSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
