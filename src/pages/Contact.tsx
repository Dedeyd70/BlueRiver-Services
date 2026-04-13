import { useState } from "react";
import { notifyAdmins } from "@/lib/notifications";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, CheckCircle, Clock, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useQuery } from "@tanstack/react-query";
import { isValidEmail } from "@/lib/validation";
import PageMeta from "@/components/PageMeta";

const Contact = () => {
  const { toast } = useToast();
  const { data: settings } = useSiteSettings();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", service: "", message: "" });

  const { data: services } = useQuery({
    queryKey: ["public-services-contact"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("title").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!isValidEmail(form.email)) {
      toast({ title: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Rate-limit check
    try {
      const { data: isRecent } = await supabase.rpc("check_recent_submission", {
        p_email: form.email.trim(),
        p_table: "contact_submissions",
      });
      if (isRecent) {
        setLoading(false);
        toast({ title: "Please wait before submitting again.", variant: "destructive" });
        return;
      }
    } catch {
      /* allow submission if rate check fails */
    }

    const { error } = await supabase.from("contact_submissions").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      service_type: form.service || null,
      message: form.message.trim(),
    });
    setLoading(false);
    if (error) {
      toast({ title: "Something went wrong.", description: "Please try again later.", variant: "destructive" });
      return;
    }

    // Notify admins of new contact message
    try {
      await notifyAdmins("contact", `New contact message from ${form.name.trim()}`);
    } catch {}

    // 30s cooldown
    setCooldown(true);
    setTimeout(() => setCooldown(false), 30000);

    setSubmitted(true);
    toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
  };

  const update =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const phone = settings?.phone || "(206) 317-8300";
  const phoneLink = settings?.phone_link || "+12063178300";
  const email = settings?.email || "joshuaquao@gmail.com";
  const serviceArea = settings?.service_area || "Serving Washington State";
  const callAvailability = settings?.call_availability || "7:00 AM – 5:00 PM";
  const businessHoursMF = settings?.business_hours_mf || "Monday – Friday: 7:00 AM – 7:00 PM";
  const businessHoursSat = settings?.business_hours_sat || "Saturday: 8:00 AM – 5:00 PM";
  const businessHoursSun = settings?.business_hours_sun || "Sunday: Closed";

  return (
    <div>
      <PageMeta
        title="Contact Us"
        description="Get in touch with BlueRiver Services. Request a quote, book a service, or contact us directly."
      />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto text-center"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">
              Get in Touch
            </span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Contact Us</h1>
            <p className="text-muted-foreground leading-relaxed">
              Request a quote, book a service, or contact us directly.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-3"
            >
              {submitted ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-display font-bold text-foreground mb-2">Thank You!</h3>
                  <p className="text-muted-foreground">We've received your request and will be in touch shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
                      <Input placeholder="Your name" value={form.name} onChange={update("name")} maxLength={100} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Email *</label>
                      <Input
                        type="email"
                        placeholder="you@email.com"
                        value={form.email}
                        onChange={update("email")}
                        maxLength={255}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Phone</label>
                      <Input
                        type="tel"
                        placeholder="(555) 123-4567"
                        value={form.phone}
                        onChange={update("phone")}
                        maxLength={20}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Service Needed</label>
                      <select
                        value={form.service}
                        onChange={update("service")}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="">Select a service</option>
                        {(services ?? []).map((s) => (
                          <option key={s.title} value={s.title}>
                            {s.title}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Message *</label>
                    <Textarea
                      placeholder="Please let us know how we can be of help..."
                      rows={5}
                      value={form.message}
                      onChange={update("message")}
                      maxLength={1000}
                    />
                  </div>
                  <Button type="submit" variant="hero" size="lg" disabled={loading || cooldown}>
                    {loading ? "Sending..." : cooldown ? "Please wait..." : "Send Message"}
                  </Button>
                </form>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="lg:col-span-2 space-y-8"
            >
              <div>
                <h3 className="font-display font-semibold text-foreground mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <a
                    href={`tel:${phoneLink}`}
                    className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-sky-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Phone</p>
                      <p className="text-sm">{phone}</p>
                      <p className="text-xs text-muted-foreground/70">Available for calls: {callAvailability}</p>
                    </div>
                  </a>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-sky-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Email</p>
                      <p className="text-sm">{email}</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="w-10 h-10 rounded-xl bg-sky flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-sky-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Service Area</p>
                      <p className="text-sm">{serviceArea}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-sky/50">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="w-4 h-4 text-foreground" />
                  <h4 className="font-display font-semibold text-foreground">Business Hours</h4>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{businessHoursMF}</p>
                  <p>{businessHoursSat}</p>
                  <p>{businessHoursSun}</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-sky/50">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-foreground" />
                  <h4 className="font-display font-semibold text-foreground">Call Availability</h4>
                </div>
                <p className="text-sm text-muted-foreground">{callAvailability}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
