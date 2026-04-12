import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";
import { Home, Building2, SprayCan, Truck, Droplets, Wind, Sparkles, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const iconMap: Record<string, any> = { Home, Building2, SprayCan, Truck, Droplets, Wind, Sparkles };

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const Services = () => {
  const { data: services } = useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const mainServices = (services ?? []).filter((s) => (s as any).service_category !== "addon");
  const addons = (services ?? []).filter((s) => (s as any).service_category === "addon");

  return (
    <div>
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">What We Offer</span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Our Services</h1>
            <p className="text-muted-foreground leading-relaxed">Professional cleaning solutions designed for every type of space.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container space-y-16">
          {mainServices.map((s, i) => {
            const Icon = iconMap[s.icon] || Sparkles;
            return (
              <motion.div key={s.id} {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className={`flex flex-col md:flex-row gap-8 items-start ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                <div className="flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-hero-gradient flex items-center justify-center mb-4">
                    <Icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-display font-bold text-foreground mb-3">{s.title}</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">{s.description}</p>
                  {s.price_starting && <p className="text-sm font-medium text-primary mb-4">Starting from {s.price_starting}</p>}
                  <ul className="space-y-2 mb-6">
                    {(s.features || []).map((b: string) => (
                      <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                  <Button variant="hero" size="sm" asChild>
                    <Link to={`/book?service=${encodeURIComponent(s.title)}`}>Book Now</Link>
                  </Button>
                </div>
                <div className="flex-1 w-full rounded-2xl overflow-hidden h-56 md:h-64">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-sky/50 flex items-center justify-center">
                      <Icon className="w-20 h-20 text-sky-foreground/40" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {addons.length > 0 && (
        <section className="py-20 md:py-28 bg-muted/50">
          <div className="container">
            <SectionHeading badge="Extras" title="Optional Add-Ons" description="Enhance your cleaning package with these popular extras." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {addons.map((a, i) => {
                const Icon = iconMap[a.icon] || Sparkles;
                return (
                  <motion.div key={a.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="p-6 rounded-2xl bg-card border border-border">
                    {a.image_url ? (
                      <img src={a.image_url} alt={a.title} className="w-full h-32 object-cover rounded-xl mb-4" loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-sky flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-sky-foreground" />
                      </div>
                    )}
                    <h3 className="font-display font-semibold text-card-foreground mb-1">{a.title}</h3>
                    {a.price_starting && <p className="text-sm font-medium text-primary mb-2">{a.price_starting}</p>}
                    <p className="text-sm text-muted-foreground mb-4">{a.description}</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/book?addon=${encodeURIComponent(a.title)}`}>Request with Booking</Link>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="py-20 md:py-28 bg-hero-gradient text-center">
        <div className="container">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4">Need a Custom Cleaning Plan?</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">Contact us for a personalized quote tailored to your space and schedule.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="hero" size="xl" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90" asChild>
                <Link to="/quote">Request a Quote</Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/book">Book Now</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Services;
