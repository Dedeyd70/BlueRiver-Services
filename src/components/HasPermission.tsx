import { ReactNode } from "react";
import { useHasPermission } from "@/hooks/usePermissions";

interface Props {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}

const HasPermission = ({ permission, fallback = null, children }: Props) => {
  const allowed = useHasPermission(permission);
  return <>{allowed ? children : fallback}</>;
};

export default HasPermission;
