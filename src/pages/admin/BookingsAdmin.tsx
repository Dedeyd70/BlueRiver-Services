import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { createInvoiceFromBooking } from "@/lib/createInvoiceFromBooking";
import { notifyAdmins } from "@/lib/notifications";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const logBookingActivity = async (
  bookingId: string,
  action: string,
  options: { details?: string; previous_status?: string; new_status?: string } = {}
) => {
  const { data: { user } } = await supabase.auth.getUser();
  await (supabase as any).from("booking_activity_logs").insert({
    booking_id: bookingId,
    action,
    details: options.details ?? null,
    previous_status: options.previous_status ?? null,
    new_status: options.new_status ?? null,
    actor_id: user?.id ?? null,
  });
};

const BookingsAdmin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status");
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: activityLogs } = useQuery({
    queryKey: ["admin-booking-activity"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_activity_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { getRef } = useFocusHighlight(!isLoading && !!bookings);

  const activeBookings = (bookings ?? []).filter((b) => {
    if (statusFilter === "pending") {
      return b.status === "pending";
    }
    return b.status === "pending" || b.status === "confirmed";
  });
  const archivedBookings = (bookings ?? []).filter((b) => b.status === "completed" || b.status === "cancelled");

  // (status updates are written directly within handlers below so we can also log activity)

  const handleConfirm = async (b: any) => {
    try {
      const { error } = await supabase.from("bookings").update({ status: "confirmed" }).eq("id", b.id);
      if (error) throw error;
      await logBookingActivity(b.id, "confirmed", { previous_status: b.status, new_status: "confirmed" });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: "Booking confirmed." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCompleted = async (b: any) => {
    try {
      // Update status first
      const { error: updErr } = await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", b.id);
      if (updErr) throw updErr;

      // Auto-create invoice
      const invoice = await createInvoiceFromBooking(b, user?.id);

      await logBookingActivity(b.id, "completed", {
        previous_status: b.status,
        new_status: "completed",
        details: invoice?.invoice_number ? `Invoice ${invoice.invoice_number} generated` : undefined,
      });

      await notifyAdmins(
        "booking_completed",
        `Booking for ${b.name} completed. Invoice ${invoice?.invoice_number ?? ""} generated.`,
        invoice?.id,
        "invoice"
      );

      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-invoices"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: `Marked completed. Invoice ${invoice?.invoice_number ?? ""} created.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      const updates: any = { status: "cancelled" };
      if (cancelReason) updates.cancellation_reason = cancelReason;
      const { error } = await supabase.from("bookings").update(updates).eq("id", cancelTarget.id);
      if (error) throw error;
      await logBookingActivity(cancelTarget.id, "cancelled", {
        previous_status: cancelTarget.status,
        new_status: "cancelled",
        details: cancelReason || undefined,
      });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-activity"] });
      toast({ title: `Booking cancelled. ${cancelReason ? `Reason: ${cancelReason}` : ""}` });
      setCancelTarget(null);
      setCancelReason("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const parseAddons = (addons: any): { title: string; price?: number }[] => {
    if (!addons || !Array.isArray(addons)) return [];
    return addons;
  };

  const getActivityFor = (bookingId: string) =>
    (activityLogs ?? []).filter((l) => l.booking_id === bookingId);

  const renderBookingCard = (b: any) => {
    const addons = parseAddons((b as any).selected_addons);
    const totalPrice = (b as any).total_price;
    const isCancelled = b.status === "cancelled";
    const isCompleted = b.status === "completed";
    const activity = getActivityFor(b.id);
    const isActivityOpen = expandedActivity === b.id;

    return (
      <div ref={getRef(b.id)} key={b.id} className="bg-card border border-border rounded-xl p-4 space-y-3 scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-foreground">{b.name}</h3>
            <p className="text-sm text-muted-foreground">
              {b.email} {b.phone && `• ${b.phone}`}
            </p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${
              isCancelled
                ? "bg-red-50 text-red-500 border-red-100"
                : statusColors[b.status] || "bg-muted text-muted-foreground"
            }`}
          >
            {b.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Date:</span>
            <p className="font-medium text-foreground">{format(new Date(b.booking_date), "MMM d, yyyy")}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Time:</span>
            <p className="font-medium text-foreground">{b.time_slot}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Service:</span>
            <p className="font-medium text-foreground">{b.service_type || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Submitted:</span>
            <p className="font-medium text-foreground">{format(new Date(b.created_at), "MMM d")}</p>
          </div>
        </div>

        {b.property_type && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Property:</span> {b.property_type}
            {b.square_footage ? ` · ${b.square_footage} sq ft` : ""}
            {b.bedrooms ? ` · ${b.bedrooms} bed` : ""}
            {b.bathrooms ? ` / ${b.bathrooms} bath` : ""}
            {(b as any).floor_type ? ` · ${(b as any).floor_type}` : ""}
          </p>
        )}

        {((b as any).condition_level || (b as any).is_empty_property) && (
          <p className="text-sm text-muted-foreground">
            {(b as any).condition_level && (
              <>
                <span className="text-foreground font-medium">Condition:</span> {(b as any).condition_level}
              </>
            )}
            {(b as any).is_empty_property && (
              <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium">Empty / Move-out</span>
            )}
          </p>
        )}

        {b.frequency && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Frequency:</span> {b.frequency}
          </p>
        )}

        {b.has_pets && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Pets:</span> Yes
            {(b as any).pet_count ? ` (${(b as any).pet_count})` : ""}
          </p>
        )}

        {b.entry_codes && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Entry Codes:</span> {b.entry_codes}
          </p>
        )}

        {addons.length > 0 && (
          <div className="text-sm">
            <span className="text-foreground font-medium">Add-Ons:</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {addons.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium"
                >
                  {a.title}
                  {a.price ? ` ($${a.price})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {totalPrice != null && totalPrice > 0 && (
          <p className="text-sm font-semibold text-primary">Total: ${Number(totalPrice).toFixed(2)}</p>
        )}

        {b.address && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Address:</span> {b.address}
          </p>
        )}

        {b.notes && (
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Notes:</span> {b.notes}
          </p>
        )}

        {(b as any).cancellation_reason && (
          <div className="mt-2 p-3 bg-red-50/50 border border-red-100/50 rounded-lg">
            <p className="text-sm text-destructive font-medium">
              Cancellation Reason: <span className="font-normal">{(b as any).cancellation_reason}</span>
            </p>
          </div>
        )}

        {/* Activity Log */}
        <div className="border-t border-border pt-3">
          <button
            onClick={() => setExpandedActivity(isActivityOpen ? null : b.id)}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <Clock className="w-3.5 h-3.5" /> Activity ({activity.length})
            {isActivityOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {isActivityOpen && (
            <div className="mt-3 space-y-2">
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
              )}
              {activity.map((entry) => (
                <div key={entry.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!isCompleted && (
          <div className="pt-3 border-t border-border/50">
            {isCancelled ? (
              <div className="py-1">
                <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
                  This booking was cancelled and cannot be modified.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {b.status === "pending" && (
                  <Button variant="default" size="sm" onClick={() => handleConfirm(b)}>
                    Confirm
                  </Button>
                )}
                {b.status === "confirmed" && (
                  <Button variant="outline" size="sm" onClick={() => handleCompleted(b)}>
                    Mark Completed
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setCancelTarget(b)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Bookings</h1>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for cancellation</label>
              <Textarea
                placeholder="Enter reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Back
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Syncing bookings...</p>
        </div>
      ) : !bookings?.length ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl border-border">
          <p className="text-muted-foreground">No bookings yet.</p>
        </div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              {statusFilter === "pending"
                ? `Pending Only (${activeBookings.length})`
                : `Active (${activeBookings.length})`}
            </TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            {activeBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center italic">No active bookings found.</p>
            ) : (
              <div className="space-y-3">{activeBookings.map(renderBookingCard)}</div>
            )}
          </TabsContent>

          <TabsContent value="archived">
            {archivedBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center italic">No archived bookings found.</p>
            ) : (
              <div className="space-y-3">{archivedBookings.map(renderBookingCard)}</div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default BookingsAdmin;
