import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SocialLink {
  id: string;
  platform_name: string;
  url: string;
  display_order: number;
  is_active: boolean;
}

export const useSocialLinks = () => {
  return useQuery({
    queryKey: ["social-links", "public"],
    queryFn: async (): Promise<SocialLink[]> => {
      const { data, error } = await supabase
        .from("social_links" as any)
        .select("id, platform_name, url, display_order, is_active")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SocialLink[];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
};

export const useAllSocialLinks = () => {
  return useQuery({
    queryKey: ["social-links", "all"],
    queryFn: async (): Promise<SocialLink[]> => {
      const { data, error } = await supabase
        .from("social_links" as any)
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SocialLink[];
    },
  });
};
