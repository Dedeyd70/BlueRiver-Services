import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type TabType = "all" | "bookings" | "quotes" | "contact";

interface UnifiedEntry {
  id: string;
  type: "Booking" | "Quote" | "Contact";
  name: string;
  email: string;
  phone: string | null;
  status: string;
  service_type: string | null;
  created_at: string;
  detail: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  requested: "bg-amber-100 text-amber-800",
  "in progress": "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
  reviewed: "bg-primary/10 text-primary",
  responded: "bg-green-100 text-green-800",
  contacted: "bg-green-100 text-green-800",
  read: "bg-blue-100 text-blue-800",
};

const Submissions = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedEntry | null>(null);

  const { data: bookings } = useQuery({
    queryKey: ["admin-bookings-sub"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes } = useQuery({
    queryKey: ["admin-quotes-sub"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quote_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_submissions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entry: UnifiedEntry) => {
      const table = entry.type === "Booking" ? "bookings" : entry.type === "Quote" ? "quote_requests" : "contact_submissions";
      const { error } = await supabase.from(table).delete().eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-quotes-sub"] });
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      toast({ title: "Submission deleted" });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const entries: UnifiedEntry[] = [
    ...(bookings ?? []).map((b) => ({
      id: b.id,
      type: "Booking" as const,
      name: b.name,
      email: b.email,
      phone: b.phone,
      status: b.status,
      service_type: b.service_type,
      created_at: b.created_at,
      detail: `${format(new Date(b.booking_date), "MMM d, yyyy")} at ${b.time_slot}`,
    })),
    ...(quotes ?? []).map((q) => ({
      id: q.id,
      type: "Quote" as const,
      name: q.name,
      email: q.email,
      phone: q.phone,
      status: q.status,
      service_type: q.service_type,
      created_at: q.created_at,
      detail: q.description?.substring(0, 80) || "—",
    })),
    ...(contacts ?? []).map((c) => ({
      id: c.id,
      type: "Contact" as const,
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
      service_type: c.service_type,
      created_at: c.created_at,
      detail: c.message?.substring(0, 80) || "—",
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = entries.filter((e) => {
    if (tab === "bookings" && e.type !== "Booking") return false;
    if (tab === "quotes" && e.type !== "Quote") return false;
    if (tab === "contact" && e.type !== "Contact") return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const allStatuses = [...new Set(entries.map((e) => e.status))];

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "all", label: "All", count: entries.length },
    { key: "bookings", label: "Bookings", count: entries.filter((e) => e.type === "Booking").length },
    { key: "quotes", label: "Quotes", count: entries.filter((e) => e.type === "Quote").length },
    { key: "contact", label: "Contact", count: entries.filter((e) => e.type === "Contact").length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-4">Submissions</h1>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this submission? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteEntry.mutate(deleteTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setStatusFilter("all"); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            statusFilter === "all" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          All Statuses
        </button>
        {allStatuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <p className="text-muted-foreground text-sm">No entries found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div key={`${e.type}-${e.id}`} className="bg-card border border-border rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.type === "Booking" ? "default" : e.type === "Quote" ? "secondary" : "outline"} className="text-xs">
                      {e.type}
                    </Badge>
                    <h3 className="font-medium text-foreground text-sm">{e.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{e.email} {e.phone && `• ${e.phone}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[e.status] || "bg-muted text-muted-foreground"}`}>
                    {e.status}
                  </span>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setDeleteTarget(e)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {e.service_type && <span>Service: <strong className="text-foreground">{e.service_type}</strong></span>}
                <span>{format(new Date(e.created_at), "MMM d, yyyy")}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{e.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Submissions;
