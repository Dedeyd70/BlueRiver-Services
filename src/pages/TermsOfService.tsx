import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import LegalContent from "@/components/LegalContent";

const TermsOfService = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["page-content", "terms-of-service"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("content, updated_at")
        .eq("page_name", "terms-of-service")
        .eq("section_key", "main")
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const content = (data?.content as { body?: string }) ?? null;

  return (
    <div>
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Our terms and conditions.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container max-w-3xl mx-auto">
          {isLoading ? (
            <p className="text-muted-foreground text-center">Loading...</p>
          ) : (
            <LegalContent body={content?.body} updatedAt={data?.updated_at} />
          )}
        </div>
      </section>
    </div>
  );
};

export default TermsOfService;
