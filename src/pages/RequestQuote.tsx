import { useState } from "react";
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
import { useServices } from "@/hooks/useServices";
import imageCompression from "browser-image-compression";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import PageMeta from "@/components/PageMeta";

const RequestQuote = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", service: searchParams.get("service") || "",
    description: "", preferred_contact: "email",
    property_type: "", square_footage: "", bedrooms: "", bathrooms: "", kitchen_count: "",
    full_bathrooms: "", half_bathrooms: "", living_rooms: "", office_rooms: "",
    floor_type: "", property_size: "",
    frequency: "", condition_level: "", has_pets: false, entry_codes: "",
    has_cabinets: false, is_empty_property: false,
  });

  const { mainServices, addons } = useServices();

  // Determine which dynamic field group to render based on service title
  const serviceLower = form.service.toLowerCase();
  const serviceGroup: "residential" | "deep" | "commercial" | "move" | "recurring" | "generic" =
    serviceLower.includes("deep") ? "deep"
    : serviceLower.includes("commercial") || serviceLower.includes("office") ? "commercial"
    : serviceLower.includes("move") ? "move"
    : (serviceLower.includes("recurring") || serviceLower.includes("weekly") || serviceLower.includes("monthly")) ? "recurring"
    : (serviceLower.includes("residential") || serviceLower.includes("regular") || serviceLower.includes("standard")) ? "residential"
    : form.service ? "generic" : "generic";


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
    if (form.phone.trim() && !isValidUSPhone(form.phone)) {
      toast({ title: "Please enter a valid US phone number.", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Please agree to be contacted.", variant: "destructive" });
      return;
    }
    setLoading(true);

    // Rate-limit check
    try {
      const { data: isRecent } = await supabase.rpc("check_recent_submission", { p_email: form.email.trim(), p_table: "quote_requests" });
      if (isRecent) {
        setLoading(false);
        toast({ title: "Please wait before submitting again.", variant: "destructive" });
        return;
      }
    } catch { /* allow quote if rate check fails */ }

    try {
      const { data: insertedQuote, error } = await supabase.from("quote_requests").insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        service_type: form.service || null,
        description: form.description.trim(),
        preferred_contact: form.preferred_contact,
        attachment_url: attachmentUrl || null,
        consent_given: consent,
        property_type: form.property_type || null,
        square_footage: form.square_footage || null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        kitchen_count: form.kitchen_count ? parseInt(form.kitchen_count) : null,
        full_bathrooms: form.full_bathrooms ? parseInt(form.full_bathrooms) : null,
        half_bathrooms: form.half_bathrooms ? parseInt(form.half_bathrooms) : null,
        living_rooms: form.living_rooms ? parseInt(form.living_rooms) : null,
        office_rooms: form.office_rooms ? parseInt(form.office_rooms) : null,
        floor_type: form.floor_type || null,
        property_size: form.property_size || null,
        frequency: form.frequency || null,
        condition_level: form.condition_level || null,
        has_pets: form.has_pets,
        has_cabinets: serviceGroup === "move" ? form.has_cabinets : null,
        is_empty_property: serviceGroup === "move" ? form.is_empty_property : null,
        entry_codes: form.entry_codes.trim() || null,
        selected_addons: selectedAddons.map((title) => ({ title })),
        status: "requested",
      } as any).select("id").maybeSingle();

      if (error) {
        toast({ title: "Quote submission failed.", description: "Please try again later.", variant: "destructive" });
        return;
      }

      await notifyAdmins("quote", `New quote request from ${form.name.trim()}`, insertedQuote?.id, "quote");

      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);

      setSubmitted(true);
      toast({ title: "Quote received!", description: "Expect a reply within 24 hours." });
    } catch {
      toast({ title: "Quote submission failed.", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
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

                {/* Service Type — drives the form */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Service Type *</label>
                  <select value={form.service} onChange={update("service")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    <option value="">Select a service</option>
                    {mainServices.map((s) => (
                      <option key={s.title} value={s.title}>{s.title}</option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  {!form.service && (
                    <p className="text-xs text-muted-foreground mt-1.5">Choose a service to see relevant details.</p>
                  )}
                </div>

                {form.service && (
                  <>
                    {/* Common: Property Type & Sq Ft */}
                    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Property</h3>
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Property Type</label>
                          <select value={form.property_type} onChange={update("property_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <option value="">Select type</option>
                            <option value="House">House</option>
                            <option value="Apartment/Condo">Apartment / Condo</option>
                            <option value="Office">Office</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">Approx. Sq Ft</label>
                          <Input placeholder="e.g. 1500" value={form.square_footage} onChange={update("square_footage")} maxLength={10} />
                        </div>
                      </div>
                    </div>

                    {/* Residential / Deep Cleaning group */}
                    {(serviceGroup === "residential" || serviceGroup === "deep") && (
                      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">
                          {serviceGroup === "deep" ? "Deep Cleaning Details" : "Residential Details"}
                        </h3>
                        <div className="grid sm:grid-cols-3 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bedrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bedrooms} onChange={update("bedrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Full Bathrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.full_bathrooms} onChange={update("full_bathrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Half Bathrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.half_bathrooms} onChange={update("half_bathrooms")} />
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Living Rooms / Halls</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.living_rooms} onChange={update("living_rooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                              Kitchens {serviceGroup === "deep" && <span className="text-primary">★</span>}
                            </label>
                            <Input type="number" min="0" max="10" placeholder="0" value={form.kitchen_count} onChange={update("kitchen_count")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                              Condition Level {serviceGroup === "deep" && <span className="text-destructive">*</span>}
                            </label>
                            <select value={form.condition_level} onChange={update("condition_level")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select condition</option>
                              <option value="light">Light</option>
                              <option value="standard">Standard</option>
                              <option value="heavy">Heavy</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Commercial group */}
                    {serviceGroup === "commercial" && (
                      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Commercial Details</h3>
                        <div className="grid sm:grid-cols-2 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bathrooms</label>
                            <Input type="number" min="0" max="50" placeholder="0" value={form.bathrooms} onChange={update("bathrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Office Rooms / Sections</label>
                            <Input type="number" min="0" max="100" placeholder="0" value={form.office_rooms} onChange={update("office_rooms")} />
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Floor Type</label>
                            <select value={form.floor_type} onChange={update("floor_type")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select floor</option>
                              <option value="carpet">Carpet</option>
                              <option value="tile">Tile</option>
                              <option value="mixed">Mixed</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Property Size</label>
                            <select value={form.property_size} onChange={update("property_size")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select size</option>
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Frequency</label>
                            <select value={form.frequency} onChange={update("frequency")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select frequency</option>
                              <option value="One-Time">One-Time</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Bi-Weekly">Bi-Weekly</option>
                              <option value="Monthly">Monthly</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Move In / Move Out group */}
                    {serviceGroup === "move" && (
                      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Move In / Move Out Details</h3>
                        <div className="grid sm:grid-cols-3 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bedrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bedrooms} onChange={update("bedrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bathrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bathrooms} onChange={update("bathrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Kitchens <span className="text-primary">★</span></label>
                            <Input type="number" min="0" max="10" placeholder="0" value={form.kitchen_count} onChange={update("kitchen_count")} />
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-5 items-end">
                          <div className="flex items-center gap-2 h-10">
                            <Checkbox id="quote-cabinets" checked={form.has_cabinets} onCheckedChange={(v) => setForm((f) => ({ ...f, has_cabinets: !!v }))} />
                            <label htmlFor="quote-cabinets" className="text-sm font-medium text-foreground cursor-pointer">Include cabinets</label>
                          </div>
                          <div className="flex items-center gap-2 h-10">
                            <Checkbox id="quote-empty" checked={form.is_empty_property} onCheckedChange={(v) => setForm((f) => ({ ...f, is_empty_property: !!v }))} />
                            <label htmlFor="quote-empty" className="text-sm font-medium text-foreground cursor-pointer">Property is empty</label>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Condition Level</label>
                            <select value={form.condition_level || "heavy"} onChange={update("condition_level")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="light">Light</option>
                              <option value="standard">Standard</option>
                              <option value="heavy">Heavy (typical)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Recurring group */}
                    {serviceGroup === "recurring" && (
                      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Recurring Cleaning Details</h3>
                        <div className="grid sm:grid-cols-3 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bedrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bedrooms} onChange={update("bedrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bathrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bathrooms} onChange={update("bathrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Kitchens</label>
                            <Input type="number" min="0" max="10" placeholder="0" value={form.kitchen_count} onChange={update("kitchen_count")} />
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Frequency</label>
                            <select value={form.frequency} onChange={update("frequency")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select frequency</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Bi-Weekly">Bi-Weekly</option>
                              <option value="Monthly">Monthly</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Maintenance Condition</label>
                            <select value={form.condition_level} onChange={update("condition_level")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select condition</option>
                              <option value="light">Light</option>
                              <option value="standard">Standard</option>
                              <option value="heavy">Heavy</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Generic fallback */}
                    {serviceGroup === "generic" && (
                      <div className="border border-border rounded-lg p-4 bg-card space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Details</h3>
                        <div className="grid sm:grid-cols-3 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bedrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bedrooms} onChange={update("bedrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Bathrooms</label>
                            <Input type="number" min="0" max="20" placeholder="0" value={form.bathrooms} onChange={update("bathrooms")} />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Kitchens</label>
                            <Input type="number" min="0" max="10" placeholder="0" value={form.kitchen_count} onChange={update("kitchen_count")} />
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-5">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Cleaning Frequency</label>
                            <select value={form.frequency} onChange={update("frequency")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select frequency</option>
                              <option value="One-Time">One-Time</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Bi-Weekly">Bi-Weekly</option>
                              <option value="Monthly">Monthly</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">Condition Level</label>
                            <select value={form.condition_level} onChange={update("condition_level")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                              <option value="">Select condition</option>
                              <option value="light">Light</option>
                              <option value="standard">Standard</option>
                              <option value="heavy">Heavy</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Common: Pets + Entry codes */}
                    <div className="flex items-center gap-2">
                      <Checkbox id="quote-pets" checked={form.has_pets} onCheckedChange={(v) => setForm((f) => ({ ...f, has_pets: !!v }))} />
                      <label htmlFor="quote-pets" className="text-sm font-medium text-foreground cursor-pointer">Pets in home</label>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Entry / Gate Codes</label>
                      <Input placeholder="Gate code, lockbox, etc." value={form.entry_codes} onChange={update("entry_codes")} maxLength={100} />
                    </div>
                  </>
                )}

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
                <Button type="submit" variant="hero" size="lg" disabled={loading || cooldown || !isFormValid} className="w-full sm:w-auto">
                  {loading ? "Submitting..." : cooldown ? "Please wait..." : "Request a Quote"}
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
