import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

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
  const { data: content, isLoading } = useQuery({
    queryKey: ["page-content", "cancellation-policy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("content")
        .eq("page_name", "cancellation-policy")
        .eq("section_key", "main")
        .maybeSingle();
      return (data?.content as { body?: string }) ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const body = content?.body || defaultContent;

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
            <div className="prose prose-sm sm:prose max-w-none text-foreground/90 leading-relaxed space-y-4">
              {body.split("\n\n").map((block: string, i: number) => {
                const trimmed = block.trim();
                if (!trimmed) return null;
                const isHeading = trimmed.length < 80 && (trimmed === trimmed.toUpperCase() || /^\d+\./.test(trimmed) || /^[A-Z][A-Za-z\s&]+$/.test(trimmed));
                if (isHeading) return <h3 key={i} className="text-lg font-display font-bold text-foreground mt-6 mb-2">{trimmed}</h3>;
                return <p key={i} className="text-muted-foreground whitespace-pre-line">{trimmed}</p>;
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CancellationPolicy;
