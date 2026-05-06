import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/NotFound";

/**
 * Stealth admin guard.
 * - While auth/role is resolving, renders nothing (blank) so probes can't fingerprint.
 * - If no user, or role is not one of the admin-area roles, renders the standard 404 page.
 */
const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { user, role, loading, roleLoading } = useAuth();

  if (loading || (user && roleLoading)) {
    return null;
  }

  const allowed = !!user && (role === "admin" || role === "manager" || role === "staff");
  if (!allowed) {
    return <NotFound />;
  }

  return <>{children}</>;
};

export default AdminGuard;
