import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";
import { Shield, Clock, Award, Sparkles, Star, Home, Building2, SprayCan, Truck, Droplets, Wind, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import heroImg from "@/assets/hero-cleaning.jpg";

const iconMap: Record<string, any> = { Home, Building2, SprayCan, Truck, Droplets, Wind, Sparkles, Shield, Clock, Award };

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const whyUs = [
  { icon: Shield, title: "Trusted & Insured", desc: "Fully licensed, bonded, and insured for your peace of mind." },
  { icon: Clock, title: "Flexible Scheduling", desc: "Appointments that fit your busy lifestyle." },
  { icon: Award, title: "Experienced Team", desc: "Trained professionals with years of expertise." },
  { icon: Sparkles, title: "Attention to Detail", desc: "We don't cut corners — we clean them." },
];

const IndexPage = () => {
  const { data: settings } = useSiteSettings();
  const { data: services } = useQuery({
    queryKey: ["public-services-home"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*").eq("is_active", true).order("display_order").limit(4);
      return data ?? [];
    },
  });
  const { data: testimonials } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const { data } = await supabase.from("testimonials").select("*").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const stripeLink = settings?.stripe_payment_link;

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center bg-hero-gradient overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Professional cleaning team at work" className="w-full h-full object-cover opacity-20" width={1920} height={1080} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-accent/80" />
        <div className="container relative z-10 py-32">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary-foreground/15 text-primary-foreground text-sm font-medium mb-6">
                ✨ Professional Cleaning Services
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-primary-foreground leading-tight mb-6">
                {settings?.hero_headline || "Reliable Cleaning Services You Can Trust"}
              </h1>
              <p className="text-lg text-primary-foreground/85 leading-relaxed mb-8 max-w-lg">
                {settings?.hero_subheadline || "From cozy homes to bustling offices, BlueRiver Services delivers spotless results with every visit."}
              </p>
              <div className="flex flex-wrap gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/contact">Get a Quote</Link>
                </Button>
                {stripeLink && (
                  <Button variant="hero-outline" size="xl" asChild>
                    <a href={stripeLink} target="_blank" rel="noopener noreferrer">Pay Now</a>
                  </Button>
                )}
                {!stripeLink && (
                  <Button variant="hero-outline" size="xl" asChild>
                    <Link to="/contact">Book Now</Link>
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-20 -left-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-float" />
      </section>

      {/* Services overview */}
      <section className="py-20 md:py-28">
        <div className="container">
          <SectionHeading badge="Our Services" title="Cleaning Solutions for Every Space" description="Whether it's your home or business, our professional team delivers exceptional results every time." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(services ?? []).slice(0, 4).map((s, i) => {
              const Icon = iconMap[s.icon] || Sparkles;
              return (
                <motion.div key={s.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
                  <Link to="/services" className="group block p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-sky flex items-center justify-center mb-4 group-hover:bg-hero-gradient group-hover:text-primary-foreground transition-all duration-300">
                      <Icon className="w-6 h-6 text-sky-foreground group-hover:text-primary-foreground" />
                    </div>
                    <h3 className="font-display font-semibold text-card-foreground mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-20 md:py-28 bg-muted/50">
        <div className="container">
          <SectionHeading badge="Why BlueRiver" title="Why Clients Choose Us" description="We go above and beyond to earn your trust and deliver results that speak for themselves." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyUs.map((item, i) => (
              <motion.div key={item.title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-28">
        <div className="container">
          <SectionHeading badge="Testimonials" title="What Our Clients Say" description="Don't just take our word for it — hear from the people who trust BlueRiver." />
          <div className="grid md:grid-cols-3 gap-6">
            {(testimonials ?? []).map((t, i) => (
              <motion.div key={t.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.15 }} className="p-6 rounded-2xl bg-card border border-border">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">"{t.content}"</p>
                <div>
                  <p className="font-display font-semibold text-card-foreground text-sm">{t.author_name}</p>
                  <p className="text-xs text-muted-foreground">{t.author_role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 bg-hero-gradient">
        <div className="container text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4">Ready for a Cleaner Space?</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">Get in touch today for a free estimate. No obligations, no hidden fees.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="hero" size="xl" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90" asChild>
                <Link to="/contact">Get a Free Quote</Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <a href={`tel:${settings?.phone_link || "+14099771515"}`} className="flex items-center gap-2"><Phone className="w-5 h-5" /> Call Us Now</a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default IndexPage;
