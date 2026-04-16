import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink, ArrowRightLeft, MessageSquare, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed: "bg-primary/10 text-primary",
  responded: "bg-green-100 text-green-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
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

  const activeQuotes = (quotes ?? []).filter((q) => {
    if (statusFilter === "pending") return q.status === "pending";
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("quote_notes").insert({ quote_id: quoteId, note, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quote-notes"] });
      setNewNote("");
      toast({ title: "Note added" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      toast({ title: "Quote request updated" });
    },
  });

  const convertToBooking = useMutation({
    mutationFn: async () => {
      if (!selectedQuote || !bookingDate || !timeSlot) throw new Error("Please select date and time");
      const { error: bookingError } = await supabase.from("bookings").insert({
        name: selectedQuote.name,
        email: selectedQuote.email,
        phone: selectedQuote.phone,
        address: selectedQuote.address || "",
        service_type: selectedQuote.service_type,
        booking_date: bookingDate,
        time_slot: timeSlot,
        notes: selectedQuote.description,
        consent_given: selectedQuote.consent_given,
        status: "confirmed",
        selected_addons: selectedQuote.selected_addons || [],
      });
      if (bookingError) throw bookingError;
      const { error: quoteError } = await supabase
        .from("quote_requests")
        .update({ status: "converted" })
        .eq("id", selectedQuote.id);
      if (quoteError) throw quoteError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
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
  const getNotesForQuote = (quoteId: string) => (allNotes ?? []).filter((n) => n.quote_id === quoteId);
  const parseAddons = (addons: any): { title: string }[] => {
    if (!addons || !Array.isArray(addons)) return [];
    return addons;
  };

  return (
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

                  return (
                    <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                      {/* Header Info */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-foreground">{q.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {q.email} {q.phone && `• ${q.phone}`}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[q.status] || "bg-muted text-muted-foreground"}`}
                        >
                          {q.status}
                        </span>
                      </div>

                      {/* The 3-Column Detail Grid */}
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

                      {/* The Sky-Blue Add-ons */}
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

                      {/* Activity Log Section */}
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
                              >
                                <Send className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {q.status !== "converted" && (
                          <Button variant="default" size="sm" onClick={() => openConvert(q)} className="gap-1">
                            <ArrowRightLeft className="w-3 h-3" /> Convert to Booking
                          </Button>
                        )}
                        {["pending", "reviewed", "responded", "closed"]
                          .filter((s) => s !== q.status && q.status !== "converted")
                          .map((s) => (
                            <Button
                              key={s}
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatus.mutate({ id: q.id, status: s })}
                              className="capitalize"
                            >
                              {s}
                            </Button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="archived">
              <div className="space-y-4">
                {archivedQuotes.map((q) => {
                  const addons = parseAddons(q.selected_addons);
                  const notes = getNotesForQuote(q.id);
                  const isExpanded = expandedNotes === q.id;
                  // Logic to determine if the record is "locked"
                  const isLocked = q.status === "closed" || q.status === "converted";

                  return (
                    <div key={q.id} className="bg-card border border-border rounded-xl p-6 space-y-4 relative">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-xl text-foreground">{q.name}</h3>
                          <p className="text-muted-foreground">
                            {q.email} <span className="mx-1">•</span> {q.phone}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm border ${
                            q.status === "closed"
                              ? "bg-red-50 text-red-500 border-red-100"
                              : "bg-green-50 text-green-600 border-green-100"
                          }`}
                        >
                          {q.status}
                        </span>
                      </div>

                      {/* 4-Column Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-2">
                        <div>
                          <p className="text-muted-foreground mb-1">Date:</p>
                          <p className="font-medium text-foreground">{format(new Date(q.created_at), "MMM d, yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">Time:</p>
                          <p className="font-medium text-foreground">{format(new Date(q.created_at), "HH:mm")}</p>
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

                      {/* Add-Ons */}
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

                            {/* We hide the Input and Button here because the record is finalized */}
                          </div>
                        )}
                      </div>

                      {/* Action Row: Only show if NOT locked */}
                      {!isLocked ? (
                        <div className="flex gap-3 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => updateStatus.mutate({ id: q.id, status: "pending" })}
                            className="rounded-lg px-6 py-2 h-auto text-sm font-medium border-border/60 hover:bg-muted"
                          >
                            Restore to Pending
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-2">
                          <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
                            This record is finalized and cannot be modified.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convert to Booking</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted p-3 rounded text-xs space-y-1">
                <p>
                  <strong>Client:</strong> {selectedQuote.name}
                </p>
                <p>
                  <strong>Email:</strong> {selectedQuote.email}
                </p>
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
    </div>
  );
};

export default QuotesAdmin;
