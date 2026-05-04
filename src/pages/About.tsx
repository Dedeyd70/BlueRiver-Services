import { motion } from "framer-motion";
import PageMeta from "@/components/PageMeta";
import SectionHeading from "@/components/SectionHeading";
import { Heart, Eye, Users, Award } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import defaultLogo from "@/assets/blueriver-logo.png";

const values = [
  { icon: Heart, title: "Customer First", desc: "Every decision starts with what's best for our clients." },
  { icon: Eye, title: "Attention to Detail", desc: "We notice the small things that make a big difference." },
  { icon: Users, title: "Team Excellence", desc: "Our people are trained, vetted, and passionate about cleaning." },
  { icon: Award, title: "Quality Guarantee", desc: "If you're not satisfied, we'll make it right and its guaranteed." },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const About = () => {
  const { data: settings, isLoading: settingsLoading } = useSiteSettings();
  const { data: branding } = useQuery({
    queryKey: ["public-branding"],
    queryFn: async () => {
      const { data } = await supabase.from("branding_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r: any) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });
  const { data: stats } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_stats" as any);
      if (error) throw error;
      return (data ?? {}) as { completed_bookings?: number; unique_customers?: number; avg_rating?: number };
    },
  });
  const { data: faqs } = useQuery({
    queryKey: ["public-faqs"],
    queryFn: async () => {
      const { data } = await supabase.from("faqs").select("*").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });
  const logoUrl = branding?.logo_url || defaultLogo;

  return (
    <div>
      <PageMeta title="About Us" description="Learn about BlueRiver Services — our mission, values, and commitment to delivering spotless spaces." />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">About Us</span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Our Story</h1>
            <p className="text-muted-foreground leading-relaxed">Delivering spotless spaces and peace of mind since day one.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            {settingsLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-28 w-28 mx-auto rounded-xl" />
                <Skeleton className="h-8 w-1/2 mx-auto" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-2/3 mx-auto" />
              </div>
            ) : (
              <motion.div {...fadeUp} className="space-y-8 text-center">
                <img src={logoUrl} alt="BlueRiver Services" className="h-28 md:h-36 w-auto mx-auto object-contain" />
                <h2 className="text-3xl font-display font-bold text-foreground">
                  {settings?.about_mission_title || "Our Mission"}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {settings?.about_mission_p1 || "At BlueRiver Services, we believe that a clean space is more than just tidy surfaces, it's about creating environments where people feel comfortable, productive, and at ease."}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {settings?.about_mission_p2 || "Our name reflects what we stand for: the steady flow of a blue river. Consistent, refreshing, and dependable."}
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-muted/50">
        <div className="container">
          <SectionHeading badge="Our Values" title="What Drives Us" description="These core values guide everything we do at BlueRiver." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div key={v.title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="p-6 rounded-2xl bg-card border border-border text-center">
                <div className="w-14 h-14 rounded-2xl bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display font-semibold text-card-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 md:py-32 bg-hero-gradient overflow-hidden">
        <div className="absolute -top-32 -right-20 w-96 h-96 bg-primary-foreground/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 bg-accent/30 rounded-full blur-3xl animate-float" />
        <div className="container relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { value: stats?.completed_bookings != null ? `${stats.completed_bookings}+` : settings?.stats_clients || "1,000+", label: "Cleanings Completed" },
              { value: stats?.unique_customers != null ? `${stats.unique_customers}+` : "500+", label: "Happy Customers" },
              { value: settings?.stats_years || "5+", label: "Years Experience" },
              { value: stats?.avg_rating ? stats.avg_rating.toFixed(1) : settings?.stats_rating || "4.9", label: "Average Rating" },
            ].map((s, i) => (
              <motion.div key={s.label} {...fadeUp} transition={{ duration: 0.6, delay: i * 0.1 }} className="text-center">
                <p className="text-5xl md:text-7xl font-display font-extrabold text-primary-foreground mb-2 drop-shadow-lg">{s.value}</p>
                <p className="text-sm md:text-base font-medium text-primary-foreground/90 uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {(faqs ?? []).length > 0 && (
        <section className="py-20 md:py-28">
          <div className="container max-w-3xl">
            <SectionHeading badge="FAQ" title="Frequently Asked Questions" description="Answers to the questions we hear most often." />
            <Accordion type="single" collapsible className="w-full">
              {faqs!.map((f: any) => (
                <AccordionItem key={f.id} value={f.id}>
                  <AccordionTrigger className="text-left font-display">{f.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">{f.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}
    </div>
  );
};

export default About;
