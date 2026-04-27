import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";

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
  in_progress: "bg-blue-100 text-blue-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
  contacted: "bg-green-100 text-green-800",
  read: "bg-blue-100 text-blue-800",
};

const linkForEntry = (entry: UnifiedEntry) => {
  const base =
    entry.type === "Booking" ? "/admin/bookings" :
    entry.type === "Quote"   ? "/admin/quotes"   :
                               "/admin/messages";
  // ?focus= triggers scroll-to + ring highlight + auto-expand on the target page
  return `${base}?focus=${entry.id}`;
};

const Submissions = () => {
  const [tab, setTab] = useState<TabType>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">Submissions</h1>
      <p className="text-sm text-muted-foreground mb-4">
        View-only inbox. Take actions in the dedicated Bookings, Quotes, or Messages pages.
      </p>

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
            {s.replace("_", " ")}
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
                    {e.status.replace("_", " ")}
                  </span>
                  <Link
                    to={linkForEntry(e)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </Link>
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
