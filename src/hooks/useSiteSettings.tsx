import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSiteSettings = () => {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((row) => {
        map[row.setting_key] = row.setting_value;
      });
      return map;
    },
    staleTime: 1000 * 60 * 5,
  });
};
