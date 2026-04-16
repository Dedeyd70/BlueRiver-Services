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

  // --- THIS IS THE COMPLETE CARD FUNCTION WITH ALL BUTTONS ---
  const renderQuoteCard = (q: any) => {
    const notes = getNotesForQuote(q.id);
    const isExpanded = expandedNotes === q.id;
    const addons = parseAddons((q as any).selected_addons);

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
            className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[q.status] || "bg-muted text-muted-foreground"}`}
          >
            {q.status}
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newNote.trim()) addNote.mutate({ quoteId: q.id, note: newNote.trim() });
                }}
                className="flex gap-2"
              >
                <Input
                  value={expandedNotes === q.id ? newNote : ""}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={addNote.isPending || !newNote.trim()}
                  className="h-8"
                >
                  <Send className="w-3 h-3" />
                </Button>
              </form>
            </div>
          )}
        </div>

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
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Quote Requests</h1>

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">
            {statusFilter === "pending" ? `Pending Only (${activeQuotes.length})` : `Active (${activeQuotes.length})`}
          </TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedQuotes.length})</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <TabsContent value="active">
              <div className="space-y-3">
                {activeQuotes.length === 0 ? (
                  <p className="text-muted-foreground">No active quotes found.</p>
                ) : (
                  activeQuotes.map(renderQuoteCard)
                )}
              </div>
            </TabsContent>

            <TabsContent value="archived">
              <div className="space-y-3">
                {archivedQuotes.length === 0 ? (
                  <p className="text-muted-foreground">No archived quotes.</p>
                ) : (
                  archivedQuotes.map(renderQuoteCard)
                )}
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Booking</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p>
                  <strong>Name:</strong> {selectedQuote.name}
                </p>
                <p>
                  <strong>Email:</strong> {selectedQuote.email}
                </p>
                {selectedQuote.phone && (
                  <p>
                    <strong>Phone:</strong> {selectedQuote.phone}
                  </p>
                )}
                {selectedQuote.service_type && (
                  <p>
                    <strong>Service:</strong> {selectedQuote.service_type}
                  </p>
                )}
                {selectedQuote.address && (
                  <p>
                    <strong>Address:</strong> {selectedQuote.address}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Booking Date</label>
                <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Time Slot</label>
                <Input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} required />
              </div>
              <Button
                onClick={() => convertToBooking.mutate()}
                className="w-full"
                disabled={convertToBooking.isPending}
              >
                {convertToBooking.isPending ? "Converting..." : "Convert to Booking"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuotesAdmin;
