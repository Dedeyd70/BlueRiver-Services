import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Sparkles, Clock, HeartHandshake, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import { notifyAdmins } from "@/lib/notifications";
import PageMeta from "@/components/PageMeta";

const SERVICE_OPTIONS = [
  "House Cleaning Only",
  "Roof Cleaning Only",
  "Both House & Roof Cleaning",
] as const;

const applicationSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100, "Name is too long"),
  email: z.string().trim().email("Please enter a valid email").max(255),
  phone: z.string().trim().min(7, "Please enter a valid phone").max(30),
  availability: z.string().min(1, "Please select your availability"),
  experience: z.string().min(1, "Please select your experience level"),
  service_type: z.enum(SERVICE_OPTIONS, { errorMap: () => ({ message: "Please choose a service type" }) }),
  message: z.string().trim().max(1000, "Please keep this under 1000 characters").optional(),
});

const COOLDOWN_KEY = "cleaner_application_last_submit";
const COOLDOWN_MS = 30_000;

const initialForm = {
  full_name: "",
  email: "",
  phone: "",
  availability: "",
  experience: "",
  service_type: "" as (typeof SERVICE_OPTIONS)[number] | "",
  message: "",
};

const BecomeACleaner = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof typeof initialForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client cooldown
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    if (last && Date.now() - last < COOLDOWN_MS) {
      toast({ title: "Please wait a moment before submitting again.", variant: "destructive" });
      return;
    }

    const parsed = applicationSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      toast({ title: "Please fix the highlighted fields.", variant: "destructive" });
      return;
    }

    if (!isValidEmail(parsed.data.email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }
    if (!isValidUSPhone(parsed.data.phone)) {
      setErrors({ phone: "Please enter a valid US phone number" });
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const { data: inserted, error } = await supabase
        .from("cleaner_applications" as any)
        .insert([
          {
            full_name: parsed.data.full_name,
            email: parsed.data.email,
            phone: parsed.data.phone,
            availability: parsed.data.availability,
            experience: parsed.data.experience,
            service_type: parsed.data.service_type,
            message: parsed.data.message?.trim() || null,
          },
        ] as any)
        .select("id")
        .maybeSingle();

      if (error) {
        toast({ title: "Could not submit application.", description: "Please try again shortly.", variant: "destructive" });
        return;
      }

      try {
        await notifyAdmins(
          "cleaner_application",
          `New cleaner application from ${parsed.data.full_name}`,
          (inserted as any)?.id,
          "cleaner_application",
        );
      } catch {}

      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      setSubmitted(true);
      toast({ title: "Application submitted!", description: "Our team will review your profile and get back to you shortly." });
    } catch {
      toast({ title: "Something went wrong.", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageMeta
        title="Become a Cleaner | BlueRiver Services"
        description="Join the BlueRiver Services cleaning team. Flexible schedule, fair pay, and a supportive crew. Apply today."
      />

      {/* Hero */}
      <section className="pt-32 pb-12 md:pt-40 md:pb-16 bg-muted/50">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" /> We're hiring
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">
              Join Our Cleaning Team
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              Build a flexible career with BlueRiver Services. We're looking for reliable, detail-oriented
              cleaners who take pride in their work.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why join */}
      <section className="py-12">
        <div className="container">
          <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon: Clock, title: "Flexible Schedule", body: "Full-time, part-time, weekends — pick the shifts that fit your life." },
              { icon: DollarSign, title: "Fair, Reliable Pay", body: "Competitive rates with consistent weekly work across Washington." },
              { icon: HeartHandshake, title: "Supportive Team", body: "A friendly crew, clear expectations, and the tools you need to succeed." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <Icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="pb-24">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-10 text-center"
              >
                <CheckCircle className="w-14 h-14 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                  Application Submitted Successfully!
                </h2>
                <p className="text-muted-foreground mb-6">
                  Our team will review your profile and get back to you shortly.
                </p>
                <Button onClick={() => navigate("/")} variant="hero" size="lg">
                  Back to Home
                </Button>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5"
                noValidate
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={update("full_name")}
                      placeholder="Jane Doe"
                      className="mt-1.5"
                    />
                    {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={update("email")}
                      placeholder="you@email.com"
                      className="mt-1.5"
                    />
                    {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={update("phone")}
                      placeholder="(555) 123-4567"
                      className="mt-1.5"
                    />
                    {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                  </div>
                  <div>
                    <Label htmlFor="availability">Availability *</Label>
                    <select
                      id="availability"
                      value={form.availability}
                      onChange={update("availability")}
                      className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select availability…</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Weekdays">Weekdays</option>
                      <option value="Weekends">Weekends</option>
                      <option value="Flexible">Flexible</option>
                    </select>
                    {errors.availability && <p className="text-xs text-destructive mt-1">{errors.availability}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="experience">Years of Cleaning Experience *</Label>
                  <select
                    id="experience"
                    value={form.experience}
                    onChange={update("experience")}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select experience…</option>
                    <option value="None">None — willing to learn</option>
                    <option value="Less than 1 year">Less than 1 year</option>
                    <option value="1-2 years">1–2 years</option>
                    <option value="3-5 years">3–5 years</option>
                    <option value="5+ years">5+ years</option>
                  </select>
                  {errors.experience && <p className="text-xs text-destructive mt-1">{errors.experience}</p>}
                </div>

                <div>
                  <Label>What type of cleaning services are you applying for? *</Label>
                  <RadioGroup
                    value={form.service_type}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, service_type: v as (typeof SERVICE_OPTIONS)[number] }))
                    }
                    className="mt-2 space-y-2"
                  >
                    {SERVICE_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        htmlFor={`svc-${opt}`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 py-2.5 cursor-pointer transition-colors"
                      >
                        <RadioGroupItem value={opt} id={`svc-${opt}`} />
                        <span className="text-sm text-foreground">{opt}</span>
                      </label>
                    ))}
                  </RadioGroup>
                  {errors.service_type && <p className="text-xs text-destructive mt-1">{errors.service_type}</p>}
                </div>

                <div>
                  <Label htmlFor="message">Tell us a bit about yourself (optional)</Label>
                  <Textarea
                    id="message"
                    rows={4}
                    value={form.message}
                    onChange={update("message")}
                    placeholder="Share your experience, certifications, or why you'd like to join."
                    className="mt-1.5"
                  />
                  {errors.message && <p className="text-xs text-destructive mt-1">{errors.message}</p>}
                </div>

                <Button type="submit" variant="hero" size="lg" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Submitting…" : "Submit Application"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default BecomeACleaner;
