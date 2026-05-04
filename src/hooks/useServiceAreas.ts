import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ServiceArea = {
  id: string;
  zip: string;
  city: string;
  is_active: boolean;
};

export const useServiceAreas = (activeOnly = true) =>
  useQuery({
    queryKey: ["service-areas", activeOnly],
    queryFn: async (): Promise<ServiceArea[]> => {
      let q = (supabase as any).from("service_areas").select("*").order("zip");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ServiceArea[];
    },
    staleTime: 5 * 60 * 1000,
  });
