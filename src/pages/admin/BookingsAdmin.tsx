import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

const BookingsAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast({ title: "Booking updated" });
    },
  });

  const parseAddons = (addons: any): { title: string; price?: number }[] => {
    if (!addons || !Array.isArray(addons)) return [];
    return addons;
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Bookings</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !bookings?.length ? (
        <p className="text-muted-foreground">No bookings yet.</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const addons = parseAddons((b as any).selected_addons);
            const totalPrice = (b as any).total_price;
            return (
              <div key={b.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-foreground">{b.name}</h3>
                    <p className="text-sm text-muted-foreground">{b.email} {b.phone && `• ${b.phone}`}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[b.status] || "bg-muted text-muted-foreground"}`}>
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
                {addons.length > 0 && (
                  <div className="text-sm">
                    <span className="text-foreground font-medium">Add-Ons:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {addons.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky text-sky-foreground text-xs font-medium">
                          {a.title}{a.price ? ` ($${a.price})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {totalPrice != null && totalPrice > 0 && (
                  <p className="text-sm font-semibold text-primary">Total: ${Number(totalPrice).toFixed(2)}</p>
                )}
                {b.address && <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Address:</span> {b.address}</p>}
                {b.notes && <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Notes:</span> {b.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  {["pending", "confirmed", "completed", "cancelled"].filter((s) => s !== b.status).map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: b.id, status: s })} className="capitalize">
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookingsAdmin;
