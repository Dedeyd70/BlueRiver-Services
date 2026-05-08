import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import LegalContent from "@/components/LegalContent";

const defaultContent = `Booking Confirmation

All bookings are subject to availability and confirmation by BlueRiver Services.

Cancellation Notice

Clients are encouraged to cancel or reschedule appointments at least 24 hours in advance.

Late Cancellations

Cancellations made less than 24 hours before the scheduled appointment may be subject to a cancellation fee.

No-Show Policy

If a client fails to be present or accessible at the scheduled time without prior notice, it may be treated as a no-show and could result in a fee or forfeiture of deposit (if applicable).

Rescheduling

Rescheduling requests should be made as early as possible and are subject to availability.

Refunds

Refund eligibility depends on the timing of cancellation and the nature of the service. Any applicable refunds will be assessed on a case-by-case basis.

Service Provider Right

BlueRiver Services reserves the right to cancel or reschedule appointments due to unforeseen circumstances such as emergencies, safety concerns, or operational constraints.`;

const CancellationPolicy = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["page-content", "cancellation-policy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("content, updated_at")
        .eq("page_name", "cancellation-policy")
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
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Cancellation Policy</h1>
            <p className="text-muted-foreground">Our cancellation and rescheduling terms.</p>
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

export default CancellationPolicy;
