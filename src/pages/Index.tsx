import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import PageMeta from "@/components/PageMeta";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";
import {
  Shield,
  Clock,
  Award,
  Sparkles,
  Star,
  Home,
  Building2,
  SprayCan,
  Truck,
  Droplets,
  Wind,
  
  MapPin,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import heroImgFallback from "@/assets/hero-cleaning.jpg";

const iconMap: Record<string, any> = {
  Home,
  Building2,
  SprayCan,
  Truck,
  Droplets,
  Wind,
  Sparkles,
  Shield,
  Clock,
  Award,
};

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
  { icon: Sparkles, title: "Attention to Detail", desc: "We don't cut corners, we clean them." },
];

const IndexPage = () => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const { data: settings } = useSiteSettings();
  const { data: allServices, isLoading: servicesLoading } = useQuery({
    queryKey: ["public-services-home-all"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const mainServices = (allServices ?? []).filter((s) => (s as any).service_category !== "addon").slice(0, 4);
  const addons = (allServices ?? []).filter((s) => (s as any).service_category === "addon");

  const { data: testimonials, isLoading: testimonialsLoading } = useQuery({
    queryKey: ["public-testimonials"],
    queryFn: async () => {
      const { data } = await supabase.from("testimonials").select("*").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });
  const { data: beforeAfter } = useQuery({
    queryKey: ["public-before-after-home"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gallery")
        .select("*")
        .eq("is_active", true)
        .neq("image_type", "single")
        .order("display_order");
      if (!data) return [];
      const groups: Record<string, { before?: (typeof data)[0]; after?: (typeof data)[0]; caption?: string }> = {};
      data.forEach((item) => {
        if (!item.group_id) return;
        if (!groups[item.group_id]) groups[item.group_id] = {};
        if (item.image_type === "before") groups[item.group_id].before = item;
        if (item.image_type === "after") groups[item.group_id].after = item;
        if (item.caption) groups[item.group_id].caption = item.caption;
      });
      return Object.entries(groups)
        .filter(([, g]) => g.before && g.after)
        .map(([id, g]) => ({
          id,
          before_image_url: g.before!.image_url,
          after_image_url: g.after!.image_url,
          caption: g.caption || "",
        }));
    },
  });
  const { data: homepageImages, isLoading } = useQuery({
    queryKey: ["public-homepage-images"],
    queryFn: async () => {
      const { data } = await supabase.from("homepage_images").select("section_key, image_url");
      const map: Record<string, string> = {};
      data?.forEach((r: any) => {
        if (r.image_url) map[r.section_key] = r.image_url;
      });
      return map;
    },
  });

  const heroImg = homepageImages?.hero ?? null;

  return (
    <div className="overflow-hidden">
      <PageMeta
        title="Home"
        description="BlueRiver Services offers reliable residential and commercial cleaning across Washington State. Get a free quote today."
      />
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center bg-gray-900 overflow-hidden">
        <div className="absolute inset-0">
          {isLoading ? (
            <div className="w-full h-full bg-gray-900" />
          ) : heroImg ? (
            <img
              src={heroImg}
              alt="Professional cleaning team at work"
              className={`w-full h-full object-cover object-center transition-opacity duration-700 ${heroLoaded ? "opacity-100" : "opacity-0"}`}
              width={1920}
              height={1080}
              onLoad={() => setHeroLoaded(true)}
            />
          ) : (
            <img
              src={heroImgFallback}
              alt="Fallback cleaning"
              className={`w-full h-full object-cover object-center transition-opacity duration-700 ${heroLoaded ? "opacity-100" : "opacity-0"}`}
              width={1920}
              height={1080}
              onLoad={() => setHeroLoaded(true)}
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="container relative z-10 py-32">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-primary-foreground leading-tight mb-6">
                {settings?.hero_headline || "Reliable Cleaning Services You Can Trust"}
              </h1>
              <p className="text-lg text-primary-foreground/85 leading-relaxed mb-4 max-w-lg">
                {settings?.hero_subheadline ||
                  "From cozy homes to bustling offices, BlueRiver Services delivers spotless results with every visit."}
              </p>
              <p className="flex items-center gap-2 text-primary-foreground/75 text-sm mb-8">
                <MapPin className="w-4 h-4" /> Serving Washington and surrounding areas
              </p>
              <div className="flex flex-wrap gap-4">
                <Button variant="hero" size="xl" asChild>
                  <Link to="/quote">Get a Free Quote</Link>
                </Button>
                <Button variant="hero-outline" size="xl" asChild>
                  <Link to="/book">Book Now</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        <div className="absolute top-20 -left-20 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-float" />
      </section>

      {/* Main Services */}
      <section className="py-20 md:py-28">
        <div className="container">
          <SectionHeading
            badge="Our Services"
            title="Cleaning Solutions for Every Space"
            description="Whether it's your home or business, our professional team delivers exceptional results every time."
          />
          {servicesLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-6 rounded-2xl bg-card border border-border">
                  <Skeleton className="w-12 h-12 rounded-xl mb-4" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mainServices.map((s, i) => {
              const Icon = iconMap[s.icon] || Sparkles;
              return (
                <motion.div key={s.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
                  <div className="group block p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.title}
                        className="w-full h-32 object-cover rounded-xl mb-4"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-sky flex items-center justify-center mb-4 group-hover:bg-hero-gradient group-hover:text-primary-foreground transition-all duration-300">
                        <Icon className="w-6 h-6 text-sky-foreground group-hover:text-primary-foreground" />
                      </div>
                    )}
                    <h3 className="font-display font-semibold text-card-foreground mb-1">{s.title}</h3>
                    {s.price_starting && (
                      <p className="text-sm font-medium text-primary mb-2">Starting from {s.price_starting}</p>
                    )}
                    <p className="text-sm text-muted-foreground mb-4">{s.description}</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/book?service=${encodeURIComponent(s.title)}`}>Book Now</Link>
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}
          <div className="text-center mt-8">
            <Button variant="outline" asChild>
              <Link to="/services">View All Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Add-Ons */}
      {addons.length > 0 && (
        <section className="py-20 md:py-28 bg-muted/50">
          <div className="container">
            <SectionHeading
              badge="Extras"
              title="Popular Add-Ons"
              description="Enhance your cleaning with these optional extras."
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {addons.map((a, i) => {
                const Icon = iconMap[a.icon] || Sparkles;
                return (
                  <motion.div key={a.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
                    <div className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                      {a.image_url ? (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          className="w-full h-32 object-cover rounded-xl mb-4"
                          loading="lazy"
                        />
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
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-20 md:py-28">
        <div className="container">
          <SectionHeading
            badge="How It Works"
            title="Simple Steps to a Cleaner Space"
            description="Getting started is easy, just follow these three steps."
          />
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Request a Quote or Book",
                desc: "Tell us about your space and needs through our booking form or quote request.",
              },
              {
                step: "2",
                title: "We Confirm & Schedule",
                desc: "Our team reviews your request, confirms availability, and locks in your appointment.",
              },
              {
                step: "3",
                title: "Enjoy a Spotless Space",
                desc: "Sit back and relax while our pros deliver a thorough, professional clean.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="text-center p-6"
              >
                <div className="w-14 h-14 rounded-full bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-display font-bold text-primary-foreground">{item.step}</span>
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="py-20 md:py-28 bg-muted/50">
        <div className="container">
          <SectionHeading
            badge="Why BlueRiver"
            title="Why Clients Choose Us"
            description="We go above and beyond to earn your trust and deliver results that speak for themselves."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyUs.map((item, i) => (
              <motion.div
                key={item.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center p-6"
              >
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

      {/* Before & After */}
      {(beforeAfter ?? []).length > 0 && (
        <section className="py-20 md:py-28">
          <div className="container">
            <SectionHeading
              badge="Results"
              title="Before & After"
              description="See the difference our professional cleaning makes."
            />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(beforeAfter ?? []).map((item, i) => (
                <motion.div
                  key={item.id}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <div className="grid grid-cols-2">
                    <div className="relative cursor-pointer" onClick={() => setLightboxImage(item.before_image_url)}>
                      <img
                        src={item.before_image_url}
                        alt="Before"
                        className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute bottom-2 left-2 bg-foreground/70 text-background text-xs font-semibold px-2 py-0.5 rounded">
                        Before
                      </span>
                    </div>
                    <div className="relative cursor-pointer" onClick={() => setLightboxImage(item.after_image_url)}>
                      <img
                        src={item.after_image_url}
                        alt="After"
                        className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute bottom-2 left-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded">
                        After
                      </span>
                    </div>
                  </div>
                  {item.caption && (
                    <div className="p-3">
                      <p className="text-sm text-muted-foreground">{item.caption}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {(testimonialsLoading || (testimonials ?? []).length > 0) && (
        <section className="py-20 md:py-28 bg-muted/50">
          <div className="container">
            <SectionHeading
              badge="Testimonials"
              title="What Our Clients Say"
              description="Don't just take our word for it, hear from the people who trust BlueRiver."
            />
            {testimonialsLoading ? (
              <div className="grid md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl bg-card border border-border">
                    <Skeleton className="h-4 w-24 mb-4" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-4 w-2/3 mb-4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                ))}
              </div>
            ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {(testimonials ?? []).map((t, i) => (
                <motion.div
                  key={t.id}
                  {...fadeUp}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="p-6 rounded-2xl bg-card border border-border"
                >
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
      )}

      {/* CTA */}
      <section className="py-20 md:py-28 bg-hero-gradient">
        <div className="container text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4">
              Ready for a Cleaner Space?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Get in touch today for a free estimate. No obligations, no hidden fees.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                variant="hero"
                size="xl"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                asChild
              >
                <Link to="/quote">Get a Free Quote</Link>
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <Link to="/book">Book Now</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <button className="absolute top-4 right-4 text-white" onClick={() => setLightboxImage(null)}>
              <X className="w-8 h-8" />
            </button>
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={lightboxImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IndexPage;
