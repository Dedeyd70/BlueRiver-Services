import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SectionHeading from "@/components/SectionHeading";
import { Home, Building2, SprayCan, Truck, Droplets, Wind, CheckCircle } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const services = [
  {
    icon: Home,
    title: "Residential Cleaning",
    desc: "Keep your home fresh and welcoming with our regular cleaning services. We handle kitchens, bathrooms, bedrooms, living areas, and more.",
    benefits: ["Customized cleaning plans", "Eco-friendly products available", "Trained & background-checked staff", "Consistent quality every visit"],
  },
  {
    icon: Building2,
    title: "Commercial Cleaning",
    desc: "Create a professional environment that impresses clients and keeps employees healthy. Office, retail, and warehouse spaces.",
    benefits: ["After-hours availability", "Tailored to your business needs", "OSHA-compliant procedures", "Monthly reporting available"],
  },
  {
    icon: SprayCan,
    title: "Deep Cleaning",
    desc: "An intensive, top-to-bottom clean for spaces that need extra attention. Perfect for seasonal refreshes or first-time clients.",
    benefits: ["Baseboards, vents & fixtures", "Inside appliances & cabinets", "Grout & tile restoration", "Sanitization of high-touch areas"],
  },
  {
    icon: Truck,
    title: "Move-in / Move-out Cleaning",
    desc: "Starting fresh or leaving a lasting impression — we make sure your property is move-in ready or deposit-ready.",
    benefits: ["Full property deep clean", "Carpet & floor care", "Window sill & track cleaning", "Garage & patio optional"],
  },
];

const addons = [
  { icon: Droplets, title: "Window Cleaning", desc: "Interior and exterior glass cleaning for a crystal-clear view." },
  { icon: Wind, title: "Floor Care", desc: "Hardwood polishing, tile scrubbing, and carpet shampooing." },
];

const Services = () => (
  <div>
    {/* Header */}
    <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">What We Offer</span>
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Our Services</h1>
          <p className="text-muted-foreground leading-relaxed">Professional cleaning solutions designed for every type of space.</p>
        </motion.div>
      </div>
    </section>

    {/* Services */}
    <section className="py-20 md:py-28">
      <div className="container space-y-16">
        {services.map((s, i) => (
          <motion.div key={s.title} {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className={`flex flex-col md:flex-row gap-8 items-start ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
            <div className="flex-1">
              <div className="w-14 h-14 rounded-2xl bg-hero-gradient flex items-center justify-center mb-4">
                <s.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-3">{s.title}</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">{s.desc}</p>
              <ul className="space-y-2">
                {s.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full rounded-2xl bg-sky/50 h-56 md:h-64 flex items-center justify-center">
              <s.icon className="w-20 h-20 text-sky-foreground/40" />
            </div>
          </motion.div>
        ))}
      </div>
    </section>

    {/* Add-ons */}
    <section className="py-20 md:py-28 bg-muted/50">
      <div className="container">
        <SectionHeading badge="Extras" title="Optional Add-Ons" description="Enhance your cleaning package with these popular extras." />
        <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {addons.map((a, i) => (
            <motion.div key={a.title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="p-6 rounded-2xl bg-card border border-border">
              <div className="w-12 h-12 rounded-xl bg-sky flex items-center justify-center mb-4">
                <a.icon className="w-6 h-6 text-sky-foreground" />
              </div>
              <h3 className="font-display font-semibold text-card-foreground mb-2">{a.title}</h3>
              <p className="text-sm text-muted-foreground">{a.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 md:py-28 bg-hero-gradient text-center">
      <div className="container">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4">Need a Custom Cleaning Plan?</h2>
          <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">Contact us for a personalized quote tailored to your space and schedule.</p>
          <Button variant="hero" size="xl" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90" asChild>
            <Link to="/contact">Request a Quote</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  </div>
);

export default Services;
