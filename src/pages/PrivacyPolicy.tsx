import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const PrivacyPolicy = () => {
  const { data: content, isLoading } = useQuery({
    queryKey: ["page-content", "privacy-policy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("content")
        .eq("page_name", "privacy-policy")
        .eq("section_key", "main")
        .maybeSingle();
      return (data?.content as { body?: string; contact_email?: string; contact_phone?: string }) ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  return (
    <div>
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">How we handle your information.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container max-w-3xl mx-auto">
          {isLoading ? (
            <p className="text-muted-foreground text-center">Loading...</p>
          ) : content?.body ? (
            <div className="prose prose-sm sm:prose max-w-none text-foreground/90 leading-relaxed space-y-4">
              {content.body.split("\n\n").map((block: string, i: number) => {
                const trimmed = block.trim();
                if (!trimmed) return null;
                // Lines that are all-caps or short (likely headings)
                const isHeading = trimmed.length < 80 && (trimmed === trimmed.toUpperCase() || /^\d+\./.test(trimmed) || /^[A-Z][A-Za-z\s&]+$/.test(trimmed));
                if (isHeading) return <h3 key={i} className="text-lg font-display font-bold text-foreground mt-6 mb-2">{trimmed}</h3>;
                return <p key={i} className="text-muted-foreground">{trimmed}</p>;
              })}
              {(content.contact_email || content.contact_phone) && (
                <div className="mt-8 p-6 rounded-2xl bg-muted/50 border border-border not-prose">
                  <h3 className="font-display font-semibold text-foreground mb-2">Contact Us About Privacy</h3>
                  {content.contact_email && <p className="text-sm text-muted-foreground">Email: <a href={`mailto:${content.contact_email}`} className="text-primary hover:underline">{content.contact_email}</a></p>}
                  {content.contact_phone && <p className="text-sm text-muted-foreground mt-1">Phone: {content.contact_phone}</p>}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center">Privacy policy content has not been configured yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
