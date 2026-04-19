import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PermissionEntry {
  id: string;
  key: string;
  label: string;
  description: string | null;
}

export const usePermissionRegistry = () => {
  return useQuery({
    queryKey: ["permission-registry"],
    queryFn: async (): Promise<PermissionEntry[]> => {
      const { data, error } = await supabase
        .from("permission_registry" as any)
        .select("*")
        .order("label", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PermissionEntry[];
    },
  });
};

/** Admin always returns true. Otherwise checks permissions JSONB. */
export const useHasPermission = (key: string): boolean => {
  const { role, permissions } = useAuth();
  if (role === "admin") return true;
  return permissions?.[key] === true;
};
