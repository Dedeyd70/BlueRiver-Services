import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ServiceArea = {
  id: string;
  /**
   * Soft-hidden: `zip` column remains in the DB (NOT NULL) so existing data
   * is preserved and the feature can be re-enabled by simply un-hiding the
   * UI. New rows inserted via the admin write `""`.
   */
  zip?: string;
  city: string;
  is_active: boolean;
};

export const useServiceAreas = (activeOnly = true) =>
  useQuery({
    queryKey: ["service-areas", activeOnly],
    queryFn: async (): Promise<ServiceArea[]> => {
      let q = (supabase as any).from("service_areas").select("id, zip, city, is_active").order("city");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ServiceArea[];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
