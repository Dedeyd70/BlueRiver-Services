import { useState } from "react";
import { notifyAdmins } from "@/lib/notifications";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, CheckCircle, Clock, CalendarDays, CalendarPlus, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import { useNavigate } from "react-router-dom";
import PageMeta from "@/components/PageMeta";

const Contact = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: settings } = useSiteSettings();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    inquiry_type: "",
    message: "",
    other_details: "",
    preferred_contact: "email",
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
    if (form.phone.trim() && !isValidUSPhone(form.phone)) {
      toast({ title: "Please enter a valid US phone number.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Rate-limit check
      const { data: isRecent } = await supabase.rpc("check_recent_submission", {
        p_email: form.email.trim(),
        p_table: "contact_submissions",
      });

      if (isRecent) {
        toast({ title: "Please wait before submitting again.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data: insertedContact, error } = await supabase
        .from("contact_submissions")
        .insert({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          service_type: form.inquiry_type || "General Inquiry",
          message: form.message.trim(),
          other_details: form.inquiry_type === "Other" ? form.other_details : null,
          preferred_contact: form.preferred_contact,
        })
        .select("id")
        .maybeSingle();

      if (error) throw error;

      await notifyAdmins(
        "contact",
        `New ${form.inquiry_type} from ${form.name.trim()}`,
        insertedContact?.id,
        "contact",
      );

      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);
      setSubmitted(true);
      toast({
        title: "Message sent!",
        description: `We'll reach out via ${form.preferred_contact} within 4 business hours.`,
      });
    } catch (err: any) {
      toast({
        title: "Message failed to send.",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const update =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const phone = settings?.phone || "(206) 317-8300";
  const email = settings?.email || "joshuaquao@gmail.com";

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Contact Us" description="Get in touch for cleaning services in Washington." />

      <section className="pt-32 pb-12 bg-muted/30">
        <div className="container px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-display font-extrabold mb-6">How Can We Help?</h1>

            {/* NEW STRATEGIC CTA BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button
                onClick={() => navigate("/book")}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-white gap-2 h-14 px-8 text-lg rounded-xl shadow-lg transition-all hover:scale-105"
              >
                <CalendarPlus className="w-5 h-5" /> Book a Service
              </Button>
              <Button
                onClick={() => navigate("/quote")}
                variant="outline"
                size="lg"
                className="gap-2 h-14 px-8 text-lg border-2 rounded-xl transition-all hover:bg-muted"
              >
                <FileText className="w-5 h-5" /> Get Free Quote
              </Button>
            </div>
            <p className="text-muted-foreground text-lg">For general questions or support, use the form below.</p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container px-4">
          <div className="grid lg:grid-cols-5 gap-12 max-w-6xl mx-auto">
            <div className="lg:col-span-3">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed"
                >
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Message Received</h3>
                  <p className="text-muted-foreground">
                    We'll contact you at <strong>{form.email}</strong> shortly.
                  </p>
                  <Button variant="link" onClick={() => setSubmitted(false)} className="mt-4">
                    Send another message
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-card p-8 rounded-3xl border shadow-sm space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Name *</label>
                      <Input placeholder="Full Name" value={form.name} onChange={update("name")} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Email *</label>
                      <Input
                        type="email"
                        placeholder="email@address.com"
                        value={form.email}
                        onChange={update("email")}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Phone (US)</label>
                      <Input type="tel" placeholder="(206) 000-0000" value={form.phone} onChange={update("phone")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Inquiry Type</label>
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary"
                        value={form.inquiry_type}
                        onChange={update("inquiry_type")}
                      >
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Billing & Payment">Billing & Payment</option>
                        <option value="Feedback & Complaints">Feedback & Complaints</option>
                        <option value="Employment">Employment Opportunities</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <AnimatePresence>
                    {form.inquiry_type === "Other" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 overflow-hidden"
                      >
                        <label className="text-sm font-semibold text-primary">Please specify your concern *</label>
                        <Input
                          placeholder="Briefly describe the topic..."
                          value={form.other_details}
                          onChange={update("other_details")}
                          required
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Preferred Contact Method</label>
                    <div className="flex gap-4">
                      {["email", "phone"].map((method) => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer capitalize">
                          <input
                            type="radio"
                            name="contact_pref"
                            value={method}
                            checked={form.preferred_contact === method}
                            onChange={update("preferred_contact")}
                            className="accent-primary"
                          />
                          {method}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Message *</label>
                    <Textarea
                      placeholder="Tell us more..."
                      rows={4}
                      value={form.message}
                      onChange={update("message")}
                      required
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full sm:w-auto px-12" disabled={loading || cooldown}>
                    {loading ? "Sending..." : cooldown ? "Please wait..." : "Send Message"}
                  </Button>
                </form>
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card p-6 rounded-2xl border space-y-6">
                <h3 className="font-bold text-xl">Direct Contact</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Call Us</p>
                      <p className="text-muted-foreground">{phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Email</p>
                      <p className="text-muted-foreground">{email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Location</p>
                      <p className="text-muted-foreground">Serving Washington State</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                <div className="flex items-center gap-2 mb-4 font-bold">
                  <Clock className="w-5 h-5" /> Business Hours
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Mon - Fri</span>
                    <span>7am - 7pm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sat</span>
                    <span>8am - 5pm</span>
                  </div>
                  <div className="flex justify-between font-semibold text-primary">
                    <span>Sun</span>
                    <span>Closed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
