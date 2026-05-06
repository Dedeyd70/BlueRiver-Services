import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Wrench, Star, Clock, Image, CalendarDays, FileQuestion, BarChart2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHasPermission } from "@/hooks/usePermissions";

const Dashboard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role } = useAuth();
  const canBookings = useHasPermission("can_manage_bookings");
  const canQuotes = useHasPermission("can_manage_quotes");
  const canMessages = useHasPermission("can_manage_messages");
  const canGallery = useHasPermission("can_manage_gallery");
  const canTestimonials = useHasPermission("can_manage_testimonials");

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-bookings-count"] });
        qc.invalidateQueries({ queryKey: ["admin-pending-bookings"] });
        qc.invalidateQueries({ queryKey: ["admin-grand-total"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quote_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-quotes-count"] });
        qc.invalidateQueries({ queryKey: ["admin-pending-quotes-count"] });
        qc.invalidateQueries({ queryKey: ["admin-grand-total"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contact_submissions" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-submissions-count"] });
        qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
        qc.invalidateQueries({ queryKey: ["admin-grand-total"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const { data: totalAll } = useQuery({
    queryKey: ["admin-grand-total"],
    queryFn: async () => {
      const [bookings, contacts, quotes] = await Promise.all([
        supabase.from("bookings").select("*", { count: "exact", head: true }),
        supabase.from("contact_submissions").select("*", { count: "exact", head: true }),
        supabase.from("quote_requests").select("*", { count: "exact", head: true }),
      ]);
      return (bookings.count ?? 0) + (contacts.count ?? 0) + (quotes.count ?? 0);
    },
  });

  const { data: submissions } = useQuery({
    queryKey: ["admin-submissions-count"],
    queryFn: async () => {
      const { count } = await supabase.from("contact_submissions").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["admin-pending-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("contact_submissions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
  });

  const { data: bookingsCount } = useQuery({
    queryKey: ["admin-bookings-count"],
    queryFn: async () => {
      const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: pendingBookings } = useQuery({
    queryKey: ["admin-pending-bookings"],
    queryFn: async () => {
      const { count } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "confirmed"]);
      return count ?? 0;
    },
  });

  const { data: quotesCount } = useQuery({
    queryKey: ["admin-quotes-count"],
    queryFn: async () => {
      const { count } = await supabase.from("quote_requests").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: pendingQuotes } = useQuery({
    queryKey: ["admin-pending-quotes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("quote_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["requested", "in_progress"]);
      return count ?? 0;
    },
  });

  const { data: servicesCount } = useQuery({
    queryKey: ["admin-services-count"],
    queryFn: async () => {
      const { count } = await supabase.from("services").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: testimonialsCount } = useQuery({
    queryKey: ["admin-testimonials-count"],
    queryFn: async () => {
      const { count } = await supabase.from("testimonials").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: galleryCount } = useQuery({
    queryKey: ["admin-gallery-count"],
    queryFn: async () => {
      const { count } = await supabase.from("gallery").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  type Stat = {
    label: string;
    value: number;
    icon: typeof BarChart2;
    color: string;
    path: string;
    description?: string;
    gate?: boolean;
  };

  const stats: Stat[] = [
    {
      label: "Total Submissions",
      value: totalAll ?? 0,
      icon: BarChart2,
      color: "text-blue-600",
      path: "/onpass-useradmin-blueriveracess052026/submissions",
      description: "Bookings + Quotes + Contacts",
      gate: canMessages,
    },
    { label: "Bookings", value: bookingsCount ?? 0, icon: CalendarDays, color: "text-primary", path: "/onpass-useradmin-blueriveracess052026/bookings", gate: canBookings },
    { label: "Active Bookings", value: pendingBookings ?? 0, icon: Clock, color: "text-amber-500", path: "/onpass-useradmin-blueriveracess052026/bookings?status=active", gate: canBookings },
    { label: "Quote Requests", value: quotesCount ?? 0, icon: FileQuestion, color: "text-accent", path: "/onpass-useradmin-blueriveracess052026/quotes", gate: canQuotes },
    { label: "Open Quotes", value: pendingQuotes ?? 0, icon: FileQuestion, color: "text-amber-500", path: "/onpass-useradmin-blueriveracess052026/quotes?status=open", gate: canQuotes },
    { label: "Contact Submissions", value: submissions ?? 0, icon: MessageSquare, color: "text-primary", path: "/onpass-useradmin-blueriveracess052026/submissions", gate: canMessages },
    { label: "New Inquiries", value: pendingCount ?? 0, icon: MessageSquare, color: "text-amber-500", path: "/onpass-useradmin-blueriveracess052026/messages", gate: canMessages },
    { label: "Services", value: servicesCount ?? 0, icon: Wrench, color: "text-accent", path: "/onpass-useradmin-blueriveracess052026/services", gate: role === "admin" },
    { label: "Gallery", value: galleryCount ?? 0, icon: Image, color: "text-accent", path: "/onpass-useradmin-blueriveracess052026/gallery", gate: canGallery },
    { label: "Testimonials", value: testimonialsCount ?? 0, icon: Star, color: "text-primary", path: "/onpass-useradmin-blueriveracess052026/testimonials", gate: canTestimonials },
  ];

  const visibleStats = stats.filter((s) => s.gate);

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Dashboard</h1>
      {visibleStats.length === 0 ? (
        <p className="text-muted-foreground text-sm">No metrics available for your role.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleStats.map((s) => (
            <div
              key={s.label}
              onClick={() => navigate(s.path)}
              className="bg-card border border-border rounded-xl p-4 sm:p-5 cursor-pointer hover:bg-muted/50 transition-all hover:shadow-sm active:scale-95"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm text-muted-foreground">{s.label}</span>
                <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} />
              </div>
              <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
