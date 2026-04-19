import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServices } from "@/hooks/useServices";
import { format, isBefore, startOfDay, getDay } from "date-fns";
import { isValidEmail, isValidUSPhone } from "@/lib/validation";
import { notifyAdmins } from "@/lib/notifications";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import PageMeta from "@/components/PageMeta";
import DynamicField from "@/components/DynamicField";

// Keys mapped to typed columns on bookings table; everything else → custom_fields JSON.
const BOOKING_TYPED_KEYS = new Set([
  "bedrooms", "bathrooms", "frequency", "has_pets", "entry_codes", "square_footage", "property_type",
]);
const BOOKING_NUMERIC_KEYS = new Set(["bedrooms", "bathrooms"]);
const BOOKING_BOOLEAN_KEYS = new Set(["has_pets"]);

const BookService = () => {
  const { toast } = useToast();
  const { data: siteSettings } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const prefilledService = searchParams.get("service") || "";
  const prefilledAddon = searchParams.get("addon") || "";
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [consent, setConsent] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(prefilledAddon ? [prefilledAddon] : []);
  const [form, setForm] = useState({
    name: searchParams.get("name") || "",
    email: searchParams.get("email") || "",
    phone: searchParams.get("phone") || "",
    address: "",
    service: prefilledService,
    service_type_id: "",
    notes: "",
    property_type: "",
    square_footage: "",
  });
  // Dynamic field values keyed by field_key
  const [dynValues, setDynValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (prefilledService) setForm((f) => ({ ...f, service: prefilledService }));
  }, [prefilledService]);

  useEffect(() => {
    if (prefilledAddon && !selectedAddons.includes(prefilledAddon)) {
      setSelectedAddons((prev) => [...prev, prefilledAddon]);
    }
  }, [prefilledAddon]);

  const { mainServices, addons } = useServices();

  // Service types drive the dynamic form (same as quote form)
  const { data: serviceTypes } = useQuery({
    queryKey: ["public-service-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("service_types").select("id,name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve service_type_id: prefer explicit selection, fall back to name match for ?service= deep links
  const matchedServiceType =
    (form.service_type_id
      ? (serviceTypes ?? []).find((s: any) => s.id === form.service_type_id)
      : undefined) ||
    (form.service
      ? (serviceTypes ?? []).find((s: any) => s.name.toLowerCase() === form.service.toLowerCase())
      : undefined);

  const { data: serviceFields } = useQuery({
    queryKey: ["public-service-fields", matchedServiceType?.id],
    queryFn: async () => {
      if (!matchedServiceType?.id) return [];
      const { data, error } = await (supabase as any)
        .from("service_fields")
        .select("*")
        .eq("service_type_id", matchedServiceType.id)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!matchedServiceType?.id,
  });

  const setDyn = (key: string, val: any) => setDynValues((p) => ({ ...p, [key]: val }));

  const { data: availability } = useQuery({
    queryKey: ["availability-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("availability_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((r: any) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: blockedDates } = useQuery({
    queryKey: ["blocked-dates"],
    queryFn: async () => {
      const { data } = await supabase.from("blocked_dates").select("blocked_date");
      return (data ?? []).map((d: any) => d.blocked_date);
    },
  });

  // Fetch already-booked slots via secure RPC (no direct table access needed)
  const { data: bookedSlots } = useQuery({
    queryKey: ["booked-slots", selectedDate ? format(selectedDate, "yyyy-MM-dd") : null],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data } = await supabase.rpc("get_booked_slots", { p_date: dateStr });
      return (data ?? []).map((r: any) => r.time_slot);
    },
    enabled: !!selectedDate,
  });

  const workingDays: number[] = availability?.working_days?.days ?? [1, 2, 3, 4, 5, 6];
  const workingHours = availability?.working_hours ?? { start: "07:00", end: "19:00" };
  const saturdayHours = availability?.saturday_hours ?? { start: "08:00", end: "17:00" };
  const slotDuration = availability?.time_slot_duration?.minutes ?? 60;

  const generateTimeSlots = (date: Date | undefined) => {
    if (!date) return [];
    const dayOfWeek = getDay(date);
    if (!workingDays.includes(dayOfWeek)) return [];
    const hours = dayOfWeek === 6 ? saturdayHours : workingHours;
    const [startH, startM] = hours.start.split(":").map(Number);
    const [endH, endM] = hours.end.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const slots: string[] = [];
    for (let m = startMin; m + slotDuration <= endMin; m += slotDuration) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      const endSlotM = m + slotDuration;
      const eh = Math.floor(endSlotM / 60);
      const em = endSlotM % 60;
      const fmt = (hr: number, mi: number) => {
        const ampm = hr >= 12 ? "PM" : "AM";
        const h12 = hr % 12 || 12;
        return `${h12}:${mi.toString().padStart(2, "0")} ${ampm}`;
      };
      slots.push(`${fmt(h, mm)} - ${fmt(eh, em)}`);
    }
    return slots;
  };

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return true;
    const dayOfWeek = getDay(date);
    if (!workingDays.includes(dayOfWeek)) return true;
    const dateStr = format(date, "yyyy-MM-dd");
    if (blockedDates?.includes(dateStr)) return true;
    return false;
  };

  const timeSlots = generateTimeSlots(selectedDate);

  // Price calculation
  const parsePrice = (p: string | null | undefined): number => {
    if (!p) return 0;
    const num = parseFloat(p.replace(/[^0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
  };

  const selectedMainService = mainServices.find((s) => s.title === form.service);
  const mainPrice = parsePrice(selectedMainService?.price_starting);
  const addonPrices = addons.filter((a) => selectedAddons.includes(a.title)).map((a) => ({ title: a.title, price: parsePrice(a.price_starting) }));
  const totalPrice = mainPrice + addonPrices.reduce((sum, a) => sum + a.price, 0);

  const toggleAddon = (title: string) => {
    setSelectedAddons((prev) => prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.address.trim() || !selectedDate || !selectedSlot) {
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
    // Required dynamic fields
    for (const f of (serviceFields ?? [])) {
      if (f.required) {
        const v = dynValues[f.field_key];
        if (v === undefined || v === null || v === "" || (f.input_type === "number" && Number(v) <= 0)) {
          toast({ title: `Please fill in: ${f.label}`, variant: "destructive" });
          return;
        }
      }
    }
    setLoading(true);

    // Rate-limit check
    try {
      const { data: isRecent } = await supabase.rpc("check_recent_submission", { p_email: form.email.trim(), p_table: "bookings" });
      if (isRecent) {
        setLoading(false);
        toast({ title: "Please wait before submitting again.", variant: "destructive" });
        return;
      }
    } catch { /* allow booking if rate check fails */ }

    // Final server-side slot availability check
    try {
      const { data: bookedSlots } = await supabase.rpc("get_booked_slots", { p_date: format(selectedDate, "yyyy-MM-dd") });
      const taken = (bookedSlots || []).map((s: any) => s.time_slot);
      if (taken.includes(selectedSlot)) {
        setLoading(false);
        toast({ title: "This time slot was just booked. Please select another.", variant: "destructive" });
        return;
      }
    } catch { /* proceed if check fails */ }
    // Determine initial status based on auto-approve setting
    const autoApprove = siteSettings?.auto_approve_bookings === "true"
      || siteSettings?.booking_approval_mode === "auto";
    const initialStatus = autoApprove ? "confirmed" : "pending";

    // Split dynamic values into typed columns vs custom_fields
    const typedPayload: Record<string, any> = {};
    const customFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(dynValues)) {
      if (v === undefined || v === null || v === "") continue;
      if (BOOKING_TYPED_KEYS.has(k)) {
        if (BOOKING_NUMERIC_KEYS.has(k)) {
          const n = parseInt(String(v), 10);
          typedPayload[k] = Number.isFinite(n) ? n : null;
        } else if (BOOKING_BOOLEAN_KEYS.has(k)) {
          typedPayload[k] = !!v;
        } else {
          typedPayload[k] = String(v);
        }
      } else {
        customFields[k] = v;
      }
    }

    try {
      const { data: insertedBooking, error } = await supabase.from("bookings").insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim(),
        service_type: form.service || null,
        service_type_id: matchedServiceType?.id ?? null,
        booking_date: format(selectedDate, "yyyy-MM-dd"),
        time_slot: selectedSlot,
        notes: form.notes.trim() || null,
        consent_given: consent,
        status: initialStatus,
        property_type: form.property_type || null,
        square_footage: form.square_footage || null,
        selected_addons: selectedAddons.map((title) => {
          const addon = addons.find((a) => a.title === title);
          return { title, price: parsePrice(addon?.price_starting) };
        }),
        total_price: totalPrice > 0 ? totalPrice : null,
        custom_fields: customFields,
        ...typedPayload,
      } as any).select("id").single();

      if (error) {
        toast({ title: "Booking failed.", description: "Please try again later.", variant: "destructive" });
        return;
      }

      await notifyAdmins("booking", `New booking from ${form.name.trim()} for ${format(selectedDate, "MMM d, yyyy")}`, insertedBooking?.id, "booking");

      setCooldown(true);
      setTimeout(() => setCooldown(false), 30000);

      setSubmitted(true);
      toast({ title: "Booking confirmed!", description: "We'll be in touch within 24 hours." });
    } catch {
      toast({ title: "Booking failed.", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div>
      <PageMeta title="Book a Service" description="Schedule your professional cleaning service with BlueRiver. Select your preferred date, time, and service." />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">Schedule Service</span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Book a Service</h1>
            <p className="text-muted-foreground leading-relaxed">Select your preferred date and time. We'll confirm your appointment shortly.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container max-w-4xl mx-auto">
          {submitted ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-hero-gradient flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-display font-bold text-foreground mb-2">Booking Received!</h3>
              <p className="text-muted-foreground">We've received your booking for {selectedDate && format(selectedDate, "MMMM d, yyyy")} at {selectedSlot}.</p>
              {totalPrice > 0 && <p className="text-primary font-semibold mt-2">Estimated Total: ${totalPrice.toFixed(2)}</p>}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Left: form fields */}
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
                    <Input placeholder="Your full name" value={form.name} onChange={update("name")} maxLength={100} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Email *</label>
                      <Input type="email" placeholder="you@email.com" value={form.email} onChange={update("email")} maxLength={255} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Phone</label>
                      <Input type="tel" placeholder="(555) 123-4567" value={form.phone} onChange={update("phone")} maxLength={20} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Address *</label>
                    <Input placeholder="Service address" value={form.address} onChange={update("address")} maxLength={300} />
                  </div>

                  {/* Service Type — drives the dynamic form */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Service *</label>
                    <select
                      value={form.service_type_id || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        const st = (serviceTypes ?? []).find((s: any) => s.id === id);
                        const name = st?.name ?? "";
                        setForm((prev) => ({ ...prev, service_type_id: id, service: name }));
                        setDynValues({});
                      }}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select a service</option>
                      {(serviceTypes ?? []).map((st: any) => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                    {!form.service && (
                      <p className="text-xs text-muted-foreground mt-1.5">Choose a service to see relevant details.</p>
                    )}
                  </div>

                  {form.service && (
                    <>
                      {/* Common: Property Type & Sq Ft */}
                      <div className="grid sm:grid-cols-2 gap-4">
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

                      {/* Dynamic admin-defined fields */}
                      {(serviceFields ?? []).length > 0 && (
                        <div className="grid sm:grid-cols-2 gap-4">
                          {(serviceFields ?? []).map((f: any) => (
                            <DynamicField
                              key={f.id}
                              field={f}
                              value={dynValues[f.field_key]}
                              onChange={(v) => setDyn(f.field_key, v)}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Add-ons selection */}
                  {form.service && addons.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Optional Add-Ons</label>
                      <div className="space-y-2">
                        {addons.map((a) => (
                          <label key={a.title} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAddons.includes(a.title) ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                            <Checkbox checked={selectedAddons.includes(a.title)} onCheckedChange={() => toggleAddon(a.title)} />
                            <span className="flex-1 text-sm font-medium text-foreground">{a.title}</span>
                            {a.price_starting && <span className="text-sm text-primary font-medium">{a.price_starting}</span>}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price summary */}
                  {form.service && totalPrice > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{form.service}</span>
                        <span className="text-foreground">${mainPrice.toFixed(2)}</span>
                      </div>
                      {addonPrices.filter((a) => a.price > 0).map((a) => (
                        <div key={a.title} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{a.title}</span>
                          <span className="text-foreground">${a.price.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                        <span className="text-foreground">Estimated Total</span>
                        <span className="text-primary">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Additional Notes</label>
                    <Textarea placeholder="Any special instructions..." rows={3} value={form.notes} onChange={update("notes")} maxLength={500} />
                  </div>
                </div>

                {/* Right: calendar and time slots */}
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">Select Date *</label>
                    <div className="bg-card border border-border rounded-xl p-3 inline-block">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => { setSelectedDate(d); setSelectedSlot(""); }}
                        disabled={isDateDisabled}
                        className="pointer-events-auto"
                      />
                    </div>
                  </div>
                  {selectedDate && timeSlots.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Select Time *</label>
                      <div className="grid grid-cols-2 gap-2">
                        {timeSlots.map((slot) => {
                          const isBooked = bookedSlots?.includes(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => !isBooked && setSelectedSlot(slot)}
                              disabled={isBooked}
                              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                isBooked
                                  ? "bg-muted border-border text-muted-foreground cursor-not-allowed line-through opacity-60"
                                  : selectedSlot === slot
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card border-border text-foreground hover:border-primary/50"
                              }`}
                            >
                              {slot}{isBooked ? " (Booked)" : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selectedDate && timeSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">No time slots available for this date.</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
                <label htmlFor="consent" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                  I agree to be contacted regarding my request. My information will be kept private.
                </label>
              </div>

              <Button type="submit" variant="hero" size="lg" disabled={loading || cooldown || !form.name.trim() || !form.email.trim() || !form.address.trim() || !selectedDate || !selectedSlot || !consent}>
                {loading ? "Submitting..." : cooldown ? "Please wait..." : "Confirm Booking"}
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

export default BookService;
