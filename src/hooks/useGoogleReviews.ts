import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleReview {
  id: string;
  author_name: string;
  author_photo_url: string | null;
  author_uri: string | null;
  rating: number;
  text: string | null;
  relative_time: string | null;
  publish_time: string | null;
}

export interface CombinedReview {
  id: string;
  source: "google" | "site";
  name: string;
  photo: string | null;
  rating: number;
  text: string | null;
  when: string | null;
  sortDate: number;
}

export const useGoogleReviews = () =>
  useQuery({
    queryKey: ["google-reviews"],
    queryFn: async (): Promise<GoogleReview[]> => {
      const { data, error } = await supabase
        .from("google_reviews" as any)
        .select("id, author_name, author_photo_url, author_uri, rating, text, relative_time, publish_time")
        .order("publish_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as GoogleReview[];
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

/** Merge Google reviews with the site's own approved reviews, newest first. */
export const combineReviews = (
  google: GoogleReview[] | undefined,
  site: Array<{ id: string; customer_name: string; rating: number; comment: string | null; created_at: string }> | undefined,
): CombinedReview[] => {
  const g: CombinedReview[] = (google ?? []).map((r) => ({
    id: `g-${r.id}`,
    source: "google",
    name: r.author_name,
    photo: r.author_photo_url,
    rating: r.rating,
    text: r.text,
    when: r.relative_time,
    sortDate: r.publish_time ? new Date(r.publish_time).getTime() : 0,
  }));
  const s: CombinedReview[] = (site ?? []).map((r) => ({
    id: `s-${r.id}`,
    source: "site",
    name: r.customer_name,
    photo: null,
    rating: r.rating,
    text: r.comment,
    when: null,
    sortDate: new Date(r.created_at).getTime(),
  }));
  return [...g, ...s].sort((a, b) => b.sortDate - a.sortDate);
};
