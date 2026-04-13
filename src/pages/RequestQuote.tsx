import { useState, useMemo } from "react";
import { notifyAdmins } from "@/lib/notifications";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import imageCompression from "browser-image-compression";
import { isValidEmail } from "@/lib/validation";
import PageMeta from "@/components/PageMeta";

const RequestQuote = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", service: searchParams.get("service") || "", description: "", preferred_contact: "email",
  });

  const { data: services } = useQuery({
    queryKey: ["public-services-quote-all"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("title, price_starting, service_category").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const mainServices = useMemo(() => (services ?? []).filter((s) => (s as any).service_category !== "addon"), [services]);
  const addons = useMemo(() => (services ?? []).filter((s) => (s as any).service_category === "addon"), [services]);

  const toggleAddon = (title: string) => {
    setSelectedAddons((prev) => prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File must be under 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      let fileToUpload: File | Blob = file;
      if (file.type.startsWith("image/")) {
        fileToUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
      }
      const ext = file.name.split(".").pop();
      const fileName = `quotes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("site-images").upload(fileName, fileToUpload);
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else {
        const { data: urlData } = supabase.storage.from("site-images").getPublicUrl(fileName);
        setAttachmentUrl(urlData.publicUrl);
        toast({ title: "File uploaded successfully" });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.description.trim()) {
      toast({ title: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!isValidEmail(form.email)) {
      toast({ title: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Please agree to be contacted.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("quote_requests").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      service_type: form.service || null,
      description: form.description.trim(),
      preferred_contact: form.preferred_contact,
      attachment_url: attachmentUrl || null,
      consent_given: consent,
      selected_addons: selectedAddons.map((title) => ({ title })),
    });
    setLoading(false);
    if (error) {
      toast({ title: "Something went wrong.", description: "Please try again later.", variant: "destructive" });
      return;
    }

    // Notify admins
    await notifyAdmins("quote", `New quote request from ${form.name.trim()}`, undefined, "quote");

    setSubmitted(true);
    toast({ title: "Quote request submitted!", description: "We'll get back to you within 24 hours." });
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const isFormValid = form.name.trim() && form.email.trim() && form.description.trim() && consent;

  return (
    <div>
      <PageMeta title="Request a Quote" description="Get a free estimate for your cleaning needs. Tell us about your space and we'll provide a customised quote." />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">Free Estimate</span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Request a Quote</h1>
            <p className="text-muted-foreground leading-relaxed">Tell us about your cleaning needs and we'll provide a customised estimate.</p>
            <p className="text-sm text-muted-foreground mt-2">We'll get back to you within 24 hours.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto">
            {submitted ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground mb-2">Thank You!</h3>
                <p className="text-muted-foreground">We've received your quote request and will be in touch within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
                    <Input placeholder="Your name" value={form.name} onChange={update("name")} maxLength={100} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Email *</label>
                    <Input type="email" placeholder="you@email.com" value={form.email} onChange={update("email")} maxLength={255} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Phone</label>
                    <Input type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={update("phone")} maxLength={20} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Preferred Contact Method</label>
                    <select value={form.preferred_contact} onChange={update("preferred_contact")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="either">Either</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Address</label>
                  <Input placeholder="Service address" value={form.address} onChange={update("address")} maxLength={300} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Service Type</label>
                  <select value={form.service} onChange={update("service")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="">Select a service</option>
                    {mainServices.map((s) => (
                      <option key={s.title} value={s.title}>{s.title}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Add-ons as requested extras */}
                {form.service && addons.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">Interested in Add-Ons? (optional)</label>
                    <p className="text-xs text-muted-foreground mb-3">Select any extras you'd like us to consider. Final pricing will be provided in your quote.</p>
                    <div className="space-y-2">
                      {addons.map((a) => (
                        <label key={a.title} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAddons.includes(a.title) ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                          <Checkbox checked={selectedAddons.includes(a.title)} onCheckedChange={() => toggleAddon(a.title)} />
                          <span className="text-sm font-medium text-foreground">{a.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Description of Request *</label>
                  <Textarea placeholder="Describe your cleaning needs, size of space, frequency, etc..." rows={5} value={form.description} onChange={update("description")} maxLength={2000} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Attach Photo (optional)</label>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                      <span><Upload className="w-4 h-4 mr-2" /> {uploading ? "Uploading..." : attachmentUrl ? "Change Photo" : "Upload Photo"}</span>
                    </Button>
                  </label>
                  {attachmentUrl && (
                    <img src={attachmentUrl} alt="Attachment" className="mt-2 w-24 h-24 rounded-lg object-cover border border-border" />
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="quote-consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                  <label htmlFor="quote-consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                    I agree to be contacted regarding my request. My information will be kept private.
                  </label>
                </div>
                <Button type="submit" variant="hero" size="lg" disabled={loading || !isFormValid} className="w-full sm:w-auto">
                  {loading ? "Submitting..." : "Request a Quote"}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default RequestQuote;
