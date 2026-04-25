import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink, ArrowRightLeft, MessageSquare, Send, Download, PlayCircle, XCircle, FileEdit, Plus, Trash2, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generateQuotePdf } from "@/lib/quotePdf";
import { notifyAdmins } from "@/lib/notifications";
import { computeQuote, recomputeFromLineItems, LineItem } from "@/lib/pricingEngine";
import DynamicQuoteSummary from "@/components/admin/DynamicQuoteSummary";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import HasPermission from "@/components/HasPermission";

const statusColors: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
};

const statusLabel = (s: string) => s.replace("_", " ");

interface DraftAddon {
  title: string;
  price: number | string;
}

interface DraftForm {
  service_type: string;
  scope: string;
  base_price: number;
  addons: DraftAddon[];
  discount: number;
  tax_rate: number;
  notes: string;
  validity_days: number;
  line_items: LineItem[];
}

const emptyDraft: DraftForm = {
  service_type: "",
  scope: "",
  base_price: 0,
  addons: [],
  discount: 0,
  tax_rate: 0,
  notes: "",
  validity_days: 7,
  line_items: [],
};

const QuotesAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [closeTarget, setCloseTarget] = useState<any>(null);
  const [closeReason, setCloseReason] = useState("");
  const [prepareTarget, setPrepareTarget] = useState<any>(null);
  const [draftForm, setDraftForm] = useState<DraftForm>(emptyDraft);

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { getRef } = useFocusHighlight(!isLoading && !!quotes);

  const { data: branding } = useQuery({
    queryKey: ["branding-for-pdf"],
    queryFn: async () => {
      const { data } = await supabase.from("branding_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["site-settings-for-pdf"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("setting_key, setting_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: drafts } = useQuery({
    queryKey: ["admin-quote-drafts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("quote_drafts").select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: pricingServiceTypes } = useQuery({
    queryKey: ["pricing-service-types"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("service_types").select("*");
      return (data ?? []) as any[];
    },
  });

  const { data: pricingRules } = useQuery({
    queryKey: ["pricing-rules"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("service_pricing_rules").select("*");
      return (data ?? []) as any[];
    },
  });

  const { data: pricingFields } = useQuery({
    queryKey: ["pricing-service-fields"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("service_fields").select("*");
      return (data ?? []) as any[];
    },
  });

  const { data: conditionSettings } = useQuery({
    queryKey: ["condition-settings"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("condition_settings").select("*");
      return (data ?? []) as any[];
    },
  });

  const draftMap: Record<string, any> = {};
  (drafts ?? []).forEach((d) => (draftMap[d.quote_id] = d));

  const activeQuotes = (quotes ?? []).filter((q) => {
    if (statusFilter === "requested") return q.status === "requested";
    return q.status !== "converted" && q.status !== "closed";
  });

  const archivedQuotes = (quotes ?? []).filter((q) => q.status === "converted" || q.status === "closed");

  const { data: allNotes } = useQuery({
    queryKey: ["admin-quote-notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quote_notes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async ({ quoteId, note }: { quoteId: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("quote_notes").insert({ quote_id: quoteId, note, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quote-notes"] });
      setNewNote("");
      toast({ title: "Note added" });
    },
  });

  const logActivity = async (quoteId: string, message: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("quote_notes").insert({ quote_id: quoteId, note: message, created_by: user?.id });
  };

  const markInProgress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_requests").update({ status: "in_progress" }).eq("id", id);
      if (error) throw error;
      await logActivity(id, "Status changed to In Progress");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote-notes"] });
      toast({ title: "Quote marked In Progress" });
    },
  });

  const closeQuote = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("quote_requests")
        .update({ status: "closed", close_reason: reason } as any)
        .eq("id", id);
      if (error) throw error;
      await logActivity(id, `Quote closed. Reason: ${reason}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quote-notes"] });
      setCloseTarget(null);
      setCloseReason("");
      toast({ title: "Quote closed and archived" });
    },
  });

  const saveDraft = useMutation({
    mutationFn: async ({ quoteId, payload, isUpdate, breakdown }: { quoteId: string; payload: DraftForm; isUpdate: boolean; breakdown: any }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const row = {
        quote_id: quoteId,
        service_type: payload.service_type || null,
        service_type_id: (prepareTarget as any)?.service_type_id ?? null,
        scope: payload.scope || null,
        base_price: Number(payload.base_price) || 0,
        addons: payload.addons.map((a) => ({ title: a.title, price: Number(a.price) || 0 })),
        discount: Number(payload.discount) || 0,
        tax_rate: Number(payload.tax_rate) || 0,
        notes: payload.notes || null,
        validity_days: Number(payload.validity_days) || 7,
        line_items: payload.line_items as any,
        breakdown,
        prepared_by: user?.id ?? null,
      };
      const { error } = await (supabase as any)
        .from("quote_drafts")
        .upsert(row, { onConflict: "quote_id" });
      if (error) throw error;
      await logActivity(quoteId, isUpdate ? "Quote draft updated" : "Quote prepared");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quote-drafts"] });
      qc.invalidateQueries({ queryKey: ["admin-quote-notes"] });
      setPrepareTarget(null);
      toast({ title: "Quote saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const convertToBooking = useMutation({
    mutationFn: async () => {
      if (!selectedQuote || !bookingDate || !timeSlot) throw new Error("Please select date and time");

      // Idempotency: 1 quote → 1 booking. Block duplicate creation.
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("quote_id", selectedQuote.id)
        .maybeSingle();
      if (existingBooking) {
        throw new Error("A booking already exists for this quote.");
      }

      const { data: settingsRows } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "auto_approve_bookings");
      const autoApprove = settingsRows?.[0]?.setting_value === "true";

      // Resolve total price: prefer existing draft (subtotal+tax), else compute live
      const draft = draftMap[selectedQuote.id];
      let total: number | null = null;
      if (draft) {
        const items: LineItem[] = Array.isArray(draft.line_items) ? draft.line_items : [];
        if (items.length > 0) {
          const recomputed = recomputeFromLineItems(items, Number(draft.tax_rate) || 0);
          total = recomputed.total;
        } else {
          total = (Number(draft.base_price) || 0) + (Number(draft.tax_rate) || 0);
        }
      } else {
        try {
          const computed = computeQuote(
            selectedQuote,
            pricingServiceTypes ?? [],
            pricingRules ?? [],
            conditionSettings ?? [],
            Number(settings?.tax_rate ?? 0) || 0,
            pricingFields ?? [],
          );
          total = computed.total;
        } catch {
          total = null;
        }
      }

      // Snapshot quote-only typed columns into custom_fields so nothing is lost
      const quoteOnlyTyped: Record<string, any> = {};
      const carryKeys = ["kitchen_count", "living_rooms", "office_rooms", "full_bathrooms", "half_bathrooms", "has_cabinets", "floor_type"];
      for (const k of carryKeys) {
        const v = (selectedQuote as any)[k];
        if (v !== null && v !== undefined && v !== "") quoteOnlyTyped[k] = v;
      }
      const mergedCustom = {
        ...(selectedQuote.custom_fields && typeof selectedQuote.custom_fields === "object" ? selectedQuote.custom_fields : {}),
        ...quoteOnlyTyped,
      };

      const { data: insertedBooking, error: bookingError } = await supabase.from("bookings").insert({
        // Contact
        name: selectedQuote.name,
        email: selectedQuote.email,
        phone: selectedQuote.phone,
        address: selectedQuote.address || "",
        // Service
        service_type: selectedQuote.service_type,
        service_type_id: selectedQuote.service_type_id ?? null,
        booking_date: bookingDate,
        time_slot: timeSlot,
        // Notes & consent
        notes: selectedQuote.description,
        consent_given: selectedQuote.consent_given,
        status: autoApprove ? "confirmed" : "pending",
        // Property snapshot
        property_type: selectedQuote.property_type ?? null,
        square_footage: selectedQuote.square_footage ?? null,
        floor_type: selectedQuote.floor_type ?? null,
        condition_level: selectedQuote.condition_level ?? null,
        is_empty_property: selectedQuote.is_empty_property ?? false,
        has_pets: selectedQuote.has_pets ?? false,
        pet_count: (selectedQuote as any).pet_count ?? null,
        entry_codes: selectedQuote.entry_codes ?? null,
        bedrooms: selectedQuote.bedrooms ?? null,
        bathrooms: selectedQuote.bathrooms ?? null,
        frequency: selectedQuote.frequency ?? null,
        // Pricing snapshot
        total_price: total,
        // Add-ons + custom fields snapshot
        selected_addons: selectedQuote.selected_addons || [],
        custom_fields: mergedCustom,
        // Link back (kept nullable so booking survives quote deletion)
        quote_id: selectedQuote.id,
      } as any).select("id").single();
      if (bookingError) throw bookingError;

      const { error: quoteError } = await supabase
        .from("quote_requests")
        .update({ status: "converted" })
        .eq("id", selectedQuote.id);
      if (quoteError) throw quoteError;

      await logActivity(selectedQuote.id, `Converted to booking on ${bookingDate} at ${timeSlot}`);

      // Booking activity log: created from quote
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("booking_activity_logs").insert({
        booking_id: insertedBooking?.id,
        action: "created",
        details: `Created from quote ${selectedQuote.id}`,
        new_status: autoApprove ? "confirmed" : "pending",
        actor_id: user?.id ?? null,
      });

      await notifyAdmins("quote_converted", `Quote from ${selectedQuote.name} converted to booking`, insertedBooking?.id, "booking");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-quote-notes"] });
      toast({ title: "Quote converted to booking!" });
      setConvertDialogOpen(false);
      setSelectedQuote(null);
      setBookingDate("");
      setTimeSlot("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openConvert = (q: any) => {
    setSelectedQuote(q);
    setConvertDialogOpen(true);
  };

  const openPrepare = (q: any) => {
    const existing = draftMap[q.id];
    const defaultTax = Number(settings?.tax_rate ?? 0) || 0;

    if (existing) {
      const existingItems: LineItem[] = Array.isArray(existing.line_items) && existing.line_items.length > 0
        ? existing.line_items
        : computeQuote(q, pricingServiceTypes ?? [], pricingRules ?? [], conditionSettings ?? [], Number(existing.tax_rate) || defaultTax, pricingFields ?? []).lineItems;
      setDraftForm({
        service_type: existing.service_type ?? "",
        scope: existing.scope ?? "",
        base_price: Number(existing.base_price) || 0,
        addons: Array.isArray(existing.addons) ? existing.addons : [],
        discount: Number(existing.discount) || 0,
        tax_rate: Number(existing.tax_rate) || defaultTax,
        notes: existing.notes ?? "",
        validity_days: Number(existing.validity_days) || 7,
        line_items: existingItems,
      });
    } else {
      const submittedAddons = Array.isArray((q as any).selected_addons) ? (q as any).selected_addons : [];
      const computed = computeQuote(q, pricingServiceTypes ?? [], pricingRules ?? [], conditionSettings ?? [], defaultTax, pricingFields ?? []);
      const baseItem = computed.lineItems.find((i) => i.type === "base");
      setDraftForm({
        ...emptyDraft,
        service_type: q.service_type ?? "",
        scope: q.description ?? "",
        addons: submittedAddons.map((a: any) => ({ title: a.title || "Add-on", price: Number(a.price) || 0 })),
        tax_rate: defaultTax,
        base_price: baseItem ? baseItem.unit_price : 0,
        line_items: computed.lineItems,
      });
    }
    setPrepareTarget(q);
  };

  const handleDownloadPdf = (q: any) => {
    const draft = draftMap[q.id];
    if (!draft) {
      toast({ title: "Prepare quote first", description: "Please prepare quote before generating PDF", variant: "destructive" });
      return;
    }
    if (!branding || !settings) return;
    generateQuotePdf(q, branding, settings, draft);
  };

  const getNotesForQuote = (quoteId: string) => (allNotes ?? []).filter((n) => n.quote_id === quoteId);
  const parseAddons = (addons: any): { title: string }[] => {
    if (!addons || !Array.isArray(addons)) return [];
    return addons;
  };

  // Live recompute via engine (integer math)
  const preview = recomputeFromLineItems(draftForm.line_items, Number(draftForm.tax_rate) || 0);

  const updateLineItem = (idx: number, patch: Partial<LineItem>) => {
    const next = draftForm.line_items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    setDraftForm({ ...draftForm, line_items: next });
  };
  const removeLineItem = (idx: number) => {
    setDraftForm({ ...draftForm, line_items: draftForm.line_items.filter((_, i) => i !== idx) });
  };
  const addCustomLineItem = () => {
    setDraftForm({
      ...draftForm,
      line_items: [...draftForm.line_items, { name: "Custom item", quantity: 1, unit_price: 0, total_price: 0, type: "addon" }],
    });
  };

  const buildBreakdown = () => ({
    line_items: preview.lineItems,
    subtotal: preview.subtotal,
    tax_rate: Number(draftForm.tax_rate || 0),
    tax_amount: preview.tax,
    total: preview.total,
    computed_at: new Date().toISOString(),
  });

  return (
    <TooltipProvider>
    <div className="p-6">
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Quote Requests</h1>

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active ({activeQuotes.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedQuotes.length})</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <TabsContent value="active">
              <div className="space-y-4">
                {activeQuotes.map((q) => {
                  const notes = getNotesForQuote(q.id);
                  const isExpanded = expandedNotes === q.id;
                  const addons = parseAddons((q as any).selected_addons);
                  const hasDraft = !!draftMap[q.id];
                  const canConvert = q.status === "in_progress" && notes.length > 0;

                  return (
                    <div ref={getRef(q.id)} key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3 scroll-mt-24">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-foreground">{q.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {q.email} {q.phone && `• ${q.phone}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasDraft && (
                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                              Quote prepared
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColors[q.status] || "bg-muted text-muted-foreground"}`}
                          >
                            {statusLabel(q.status)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Service:</span>
                          <p className="font-medium text-foreground">{q.service_type || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contact via:</span>
                          <p className="font-medium text-foreground capitalize">{q.preferred_contact}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>
                          <p className="font-medium text-foreground">{format(new Date(q.created_at), "MMM d, yyyy")}</p>
                        </div>
                      </div>

                      {addons.length > 0 && (
                        <div className="text-sm">
                          <span className="text-foreground font-medium">Requested Add-Ons:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {addons.map((a, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium"
                              >
                                {a.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {q.address && (
                        <p className="text-sm text-muted-foreground">
                          <span className="text-foreground font-medium">Address:</span> {q.address}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground font-medium">Description:</span> {q.description}
                      </p>

                      {q.attachment_url && (
                        <a
                          href={q.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> View Attachment
                        </a>
                      )}

                      {/* Activity Log */}
                      <div className="border-t border-border pt-3">
                        <button
                          onClick={() => setExpandedNotes(isExpanded ? null : q.id)}
                          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Activity Log ({notes.length})
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
                            {notes.map((n) => (
                              <div key={n.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                                <p className="text-foreground">{n.note}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(n.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Input
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Add a note..."
                                className="flex-1 h-8 text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addNote.mutate({ quoteId: q.id, note: newNote })}
                                className="h-8"
                                disabled={!newNote.trim()}
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <HasPermission permission="can_manage_quotes">
                          {q.status === "requested" && (
                            <Button variant="outline" size="sm" onClick={() => markInProgress.mutate(q.id)} className="gap-1">
                              <PlayCircle className="w-3 h-3" /> Mark In Progress
                            </Button>
                          )}

                          {q.status === "in_progress" && (
                            <Button variant="outline" size="sm" onClick={() => openPrepare(q)} className="gap-1">
                              <FileEdit className="w-3 h-3" /> {hasDraft ? "Edit Quote" : "Prepare Quote"}
                            </Button>
                          )}
                        </HasPermission>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadPdf(q)}
                                className="gap-1"
                                aria-disabled={!hasDraft}
                                disabled={!hasDraft}
                              >
                                <Download className="w-3 h-3" /> Generate Quote PDF
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!hasDraft && (
                            <TooltipContent>Please prepare quote before generating PDF</TooltipContent>
                          )}
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button variant="outline" size="sm" disabled className="gap-1">
                                <Mail className="w-3 h-3" /> Send Quote
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Email integration coming soon</TooltipContent>
                        </Tooltip>

                        {q.status === "in_progress" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => {
                                    if (!canConvert) {
                                      toast({
                                        title: "Activity log required",
                                        description: "Please add at least one interaction before converting this quote",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    openConvert(q);
                                  }}
                                  className="gap-1"
                                  aria-disabled={!canConvert}
                                >
                                  <ArrowRightLeft className="w-3 h-3" /> Convert to Booking
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!canConvert && (
                              <TooltipContent>Add at least one activity log note before converting.</TooltipContent>
                            )}
                          </Tooltip>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCloseTarget(q)}
                          className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <XCircle className="w-3 h-3" /> Close
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {activeQuotes.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center italic">No active quote requests.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="archived">
              <div className="space-y-4">
                {archivedQuotes.map((q) => {
                  const addons = parseAddons(q.selected_addons);
                  const notes = getNotesForQuote(q.id);
                  const isExpanded = expandedNotes === q.id;

                  return (
                    <div ref={getRef(q.id)} key={q.id} className="bg-card border border-border rounded-xl p-6 space-y-4 relative scroll-mt-24">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-xl text-foreground">{q.name}</h3>
                          <p className="text-muted-foreground">
                            {q.email} <span className="mx-1">•</span> {q.phone}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm border capitalize ${
                            q.status === "closed"
                              ? "bg-red-50 text-red-500 border-red-100"
                              : "bg-green-50 text-green-600 border-green-100"
                          }`}
                        >
                          {statusLabel(q.status)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
                        <div>
                          <p className="text-muted-foreground mb-1">Date:</p>
                          <p className="font-medium text-foreground">{format(new Date(q.created_at), "MMM d, yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Service:</p>
                          <p className="font-medium text-foreground leading-tight">
                            {q.service_type || "General Inquiry"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Submitted:</p>
                          <p className="font-medium text-foreground">{format(new Date(q.created_at), "MMM d")}</p>
                        </div>
                      </div>

                      {addons.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">Add-Ons:</p>
                          <div className="flex flex-wrap gap-2">
                            {addons.map((a, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium"
                              >
                                {a.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          <span className="text-foreground font-medium">Address:</span> {q.address || "N/A"}
                        </p>
                        <p className="text-muted-foreground">
                          <span className="text-foreground font-medium">Notes:</span> {q.description}
                        </p>
                        {(q as any).close_reason && (
                          <p className="text-destructive">
                            <span className="font-medium">Close reason:</span> {(q as any).close_reason}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-border pt-3">
                        <button
                          onClick={() => setExpandedNotes(isExpanded ? null : q.id)}
                          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Activity Log ({notes.length})
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
                            {notes.map((n) => (
                              <div key={n.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                                <p className="text-foreground">{n.note}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(n.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
                          This record is finalized and cannot be modified.
                        </p>
                      </div>
                    </div>
                  );
                })}
                {archivedQuotes.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center italic">No archived quotes.</p>
                )}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Prepare Quote dialog */}
      <Dialog open={!!prepareTarget} onOpenChange={(o) => !o && setPrepareTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draftMap[prepareTarget?.id] ? "Edit Quote" : "Prepare Quote"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Property Summary (read-only) */}
            {prepareTarget && (
              <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Property Summary</h4>
                  {(prepareTarget as any).condition_level && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                      {(prepareTarget as any).condition_level}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 text-xs">
                  <div><span className="text-muted-foreground">Service:</span> <span className="font-medium">{prepareTarget.service_type || "—"}</span></div>
                  {prepareTarget.property_type && (
                    <div><span className="text-muted-foreground">Property:</span> <span className="font-medium">{prepareTarget.property_type}</span></div>
                  )}
                  {prepareTarget.square_footage && (
                    <div><span className="text-muted-foreground">Sq ft:</span> <span className="font-medium">{prepareTarget.square_footage}</span></div>
                  )}
                  {prepareTarget.frequency && (
                    <div><span className="text-muted-foreground">Frequency:</span> <span className="font-medium">{prepareTarget.frequency}</span></div>
                  )}
                  {prepareTarget.has_pets != null && (
                    <div><span className="text-muted-foreground">Pets:</span> <span className="font-medium">{prepareTarget.has_pets ? "Yes" : "No"}</span></div>
                  )}
                  <DynamicQuoteSummary serviceTypeId={prepareTarget.service_type_id} serviceTypeName={prepareTarget.service_type} request={prepareTarget} />
                </div>
                {prepareTarget.entry_codes && (
                  <div className="text-xs"><span className="text-muted-foreground">Entry codes:</span> <span className="font-medium">{prepareTarget.entry_codes}</span></div>
                )}
                {Array.isArray(prepareTarget.selected_addons) && prepareTarget.selected_addons.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {prepareTarget.selected_addons.map((a: any, i: number) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium">
                        {a.title}
                      </span>
                    ))}
                  </div>
                )}
                {prepareTarget.description && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View customer description</summary>
                    <p className="mt-1 text-foreground whitespace-pre-wrap">{prepareTarget.description}</p>
                  </details>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Service type</label>
                <Input
                  value={draftForm.service_type}
                  onChange={(e) => setDraftForm({ ...draftForm, service_type: e.target.value })}
                  placeholder="e.g. Deep Cleaning"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Validity (days)</label>
                <Input
                  type="number"
                  min={1}
                  value={draftForm.validity_days}
                  onChange={(e) => setDraftForm({ ...draftForm, validity_days: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Scope / description</label>
              <Textarea
                rows={3}
                value={draftForm.scope}
                onChange={(e) => setDraftForm({ ...draftForm, scope: e.target.value })}
                placeholder="What's included in the service..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Tax rate (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={draftForm.tax_rate}
                  onChange={(e) => setDraftForm({ ...draftForm, tax_rate: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Pricing is auto-calculated from the database pricing engine. Edit any line below to adjust.
                </p>
              </div>
            </div>

            {/* Itemized Pricing Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Itemized Pricing</label>
                <Button type="button" size="sm" variant="outline" onClick={addCustomLineItem} className="h-7 gap-1">
                  <Plus className="w-3 h-3" /> Add line
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit ($)</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {draftForm.line_items.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground italic">No line items. Add the service type and rooms in the customer form, or add custom lines.</p>
                )}
                {draftForm.line_items.map((it, idx) => {
                  const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-t border-border">
                      <Input
                        className="col-span-6 h-9"
                        value={it.name}
                        onChange={(e) => updateLineItem(idx, { name: e.target.value })}
                      />
                      <Input
                        type="number" step="1" min="0"
                        className="col-span-2 h-9 text-right"
                        value={it.quantity}
                        onChange={(e) => updateLineItem(idx, { quantity: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                      />
                      <Input
                        type="number" step="1" min="0"
                        className="col-span-2 h-9 text-right"
                        value={it.unit_price}
                        onChange={(e) => updateLineItem(idx, { unit_price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                      />
                      <div className="col-span-1 text-right text-sm font-medium">${lineTotal.toFixed(2)}</div>
                      <Button
                        type="button" size="icon" variant="ghost"
                        onClick={() => removeLineItem(idx)}
                        className="col-span-1 h-8 w-8 justify-self-end"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Notes (what's included / excluded)</label>
              <Textarea
                rows={3}
                value={draftForm.notes}
                onChange={(e) => setDraftForm({ ...draftForm, notes: e.target.value })}
              />
            </div>

            {/* Live totals */}
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between border-t border-border pt-1"><span className="text-muted-foreground">Subtotal</span><span>${preview.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({draftForm.tax_rate || 0}%)</span><span>${preview.tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>${preview.total.toFixed(2)}</span></div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrepareTarget(null)}>Cancel</Button>
            <Button
              onClick={() => prepareTarget && saveDraft.mutate({ quoteId: prepareTarget.id, payload: draftForm, isUpdate: !!draftMap[prepareTarget.id], breakdown: buildBreakdown() })}
              disabled={saveDraft.isPending}
            >
              {saveDraft.isPending ? "Saving..." : "Save Quote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Booking</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted p-3 rounded text-xs space-y-1">
                <p><strong>Client:</strong> {selectedQuote.name}</p>
                <p><strong>Email:</strong> {selectedQuote.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Date</label>
                  <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Time</label>
                  <Input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={() => convertToBooking.mutate()}
                className="w-full"
                disabled={convertToBooking.isPending}
              >
                {convertToBooking.isPending ? "Processing..." : "Confirm & Create Booking"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close-reason dialog */}
      <Dialog open={!!closeTarget} onOpenChange={() => setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium">Reason for closing</label>
            <Textarea
              placeholder="e.g. Client chose another provider, out of service area..."
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>Back</Button>
            <Button
              variant="destructive"
              onClick={() => closeTarget && closeQuote.mutate({ id: closeTarget.id, reason: closeReason || "No reason provided" })}
              disabled={closeQuote.isPending}
            >
              Close Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default QuotesAdmin;
