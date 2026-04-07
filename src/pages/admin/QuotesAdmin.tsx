import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink, ArrowRightLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quote_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-quotes-sub"] });
      toast({ title: "Quote request updated" });
    },
  });

  const convertToBooking = useMutation({
    mutationFn: async () => {
      if (!selectedQuote || !bookingDate || !timeSlot) throw new Error("Please select date and time");
      // Create booking from quote data
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
      });
      if (bookingError) throw bookingError;

      // Update quote status to converted
      const { error: quoteError } = await supabase
        .from("quote_requests")
        .update({ status: "converted" })
        .eq("id", selectedQuote.id);
      if (quoteError) throw quoteError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-quotes-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
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

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Quote Requests</h1>

      {/* Convert to Booking Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Booking</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Name:</strong> {selectedQuote.name}</p>
                <p><strong>Email:</strong> {selectedQuote.email}</p>
                {selectedQuote.phone && <p><strong>Phone:</strong> {selectedQuote.phone}</p>}
                {selectedQuote.service_type && <p><strong>Service:</strong> {selectedQuote.service_type}</p>}
                {selectedQuote.address && <p><strong>Address:</strong> {selectedQuote.address}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Booking Date</label>
                <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Time Slot</label>
                <Input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} placeholder="e.g. 9:00 AM" required />
              </div>
              <Button onClick={() => convertToBooking.mutate()} className="w-full" disabled={convertToBooking.isPending}>
                {convertToBooking.isPending ? "Converting..." : "Convert to Booking"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !quotes?.length ? (
        <p className="text-muted-foreground">No quote requests yet.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-foreground">{q.name}</h3>
                  <p className="text-sm text-muted-foreground">{q.email} {q.phone && `• ${q.phone}`}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[q.status] || "bg-muted text-muted-foreground"}`}>
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
              {q.address && <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Address:</span> {q.address}</p>}
              <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Description:</span> {q.description}</p>
              {q.attachment_url && (
                <a href={q.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> View Attachment
                </a>
              )}
              <div className="flex flex-wrap gap-2">
                {q.status !== "converted" && (
                  <Button variant="default" size="sm" onClick={() => openConvert(q)} className="gap-1">
                    <ArrowRightLeft className="w-3 h-3" /> Convert to Booking
                  </Button>
                )}
                {["pending", "reviewed", "responded", "closed"].filter((s) => s !== q.status && q.status !== "converted").map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: q.id, status: s })} className="capitalize">
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuotesAdmin;
