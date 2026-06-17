import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useServices = () => {
  const { data: services, isLoading } = useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, title, description, icon, features, price_starting, image_url, service_category, display_order")
        .eq("is_active", true)
        .order("display_order");
      return data ?? [];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const allServices = services ?? [];
  const mainServices = allServices.filter((s) => s.service_category !== "addon");
  const addons = allServices.filter((s) => s.service_category === "addon");

  return { services: allServices, mainServices, addons, isLoading };
};
