import { motion } from "framer-motion";
import SectionHeading from "@/components/SectionHeading";
import { Heart, Eye, Users, Award } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

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
  const { data: settings } = useSiteSettings();

  return (
    <div>
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
            <motion.div {...fadeUp} className="space-y-6 text-center">
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

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "1,000+", label: "Happy Clients" },
              { value: "5+", label: "Years Experience" },
              { value: "98%", label: "Satisfaction Rate" },
              { value: "10+", label: "Team Members" },
            ].map((s, i) => (
              <motion.div key={s.label} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="text-center">
                <p className="text-3xl md:text-4xl font-display font-extrabold text-gradient mb-1">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
