import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import LegalContent from "@/components/LegalContent";

const defaultContent = `General Information

BlueRiver Services provides residential and commercial cleaning services with the aim of maintaining high-quality standards. However, all services are provided on a best-effort basis.

Service Limitations

While we take care to handle all property with professionalism and caution, certain risks may exist depending on the condition of the property, materials, or environment.

No Guarantees

We do not guarantee the removal of all stains, dirt, or damages. Results may vary depending on surface type, material condition, and severity of the issue.

Client Responsibility

Clients are responsible for:
• Securing fragile or valuable items prior to service
• Informing us of any special conditions, hazards, or sensitive areas
• Providing accurate information about the service requirements

Damage Disclaimer

BlueRiver Services shall not be held liable for:
• Pre-existing damages
• Hidden or structural defects
• Items not properly secured or disclosed by the client
• Any indirect, incidental, or consequential damages arising from service

Limitation of Liability

To the maximum extent permitted by applicable law, BlueRiver Services' total liability shall not exceed the amount paid for the service in question.

Governing Law

This disclaimer is governed by the laws applicable within the United States, specifically the state in which services are rendered.`;

const LiabilityDisclaimer = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["page-content", "liability-disclaimer"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("content, updated_at")
        .eq("page_name", "liability-disclaimer")
        .eq("section_key", "main")
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const body = (data?.content as { body?: string })?.body || defaultContent;

  return (
    <div>
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Liability Disclaimer</h1>
            <p className="text-muted-foreground">Our liability terms and conditions.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container max-w-3xl mx-auto">
          {isLoading ? (
            <p className="text-muted-foreground text-center">Loading...</p>
          ) : (
            <LegalContent body={body} updatedAt={data?.updated_at} />
          )}
        </div>
      </section>
    </div>
  );
};

export default LiabilityDisclaimer;
