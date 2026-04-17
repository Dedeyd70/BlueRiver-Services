import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink, ArrowRightLeft, MessageSquare, Send, Download, PlayCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generateQuotePdf } from "@/lib/quotePdf";
import { notifyAdmins } from "@/lib/notifications";

const statusColors: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
};

const statusLabel = (s: string) => s.replace("_", " ");

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

  const convertToBooking = useMutation({
    mutationFn: async () => {
      if (!selectedQuote || !bookingDate || !timeSlot) throw new Error("Please select date and time");

      // Read auto-approve setting
      const { data: settingsRows } = await supabase
        .from("site_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "auto_approve_bookings");
      const autoApprove = settingsRows?.[0]?.setting_value === "true";

      const { data: insertedBooking, error: bookingError } = await supabase.from("bookings").insert({
        name: selectedQuote.name,
        email: selectedQuote.email,
        phone: selectedQuote.phone,
        address: selectedQuote.address || "",
        service_type: selectedQuote.service_type,
        booking_date: bookingDate,
        time_slot: timeSlot,
        notes: selectedQuote.description,
        consent_given: selectedQuote.consent_given,
        status: autoApprove ? "confirmed" : "pending",
        selected_addons: selectedQuote.selected_addons || [],
        quote_id: selectedQuote.id,
      } as any).select("id").single();
      if (bookingError) throw bookingError;

      const { error: quoteError } = await supabase
        .from("quote_requests")
        .update({ status: "converted" })
        .eq("id", selectedQuote.id);
      if (quoteError) throw quoteError;

      await logActivity(selectedQuote.id, `Converted to booking on ${bookingDate} at ${timeSlot}`);
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

  const handleDownloadPdf = (q: any) => {
    if (!branding || !settings) return;
    generateQuotePdf(q, branding, settings);
  };

  const getNotesForQuote = (quoteId: string) => (allNotes ?? []).filter((n) => n.quote_id === quoteId);
  const parseAddons = (addons: any): { title: string }[] => {
    if (!addons || !Array.isArray(addons)) return [];
    return addons;
  };

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
                  const canConvert = q.status === "in_progress" && notes.length > 0;

                  return (
                    <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-foreground">{q.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {q.email} {q.phone && `• ${q.phone}`}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColors[q.status] || "bg-muted text-muted-foreground"}`}
                        >
                          {statusLabel(q.status)}
                        </span>
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
                        {q.status === "requested" && (
                          <Button variant="outline" size="sm" onClick={() => markInProgress.mutate(q.id)} className="gap-1">
                            <PlayCircle className="w-3 h-3" /> Mark In Progress
                          </Button>
                        )}

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

                        <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(q)} className="gap-1">
                          <Download className="w-3 h-3" /> Quote PDF
                        </Button>

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
                    <div key={q.id} className="bg-card border border-border rounded-xl p-6 space-y-4 relative">
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
