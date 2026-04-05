import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Wrench, Star, Clock, Image, CalendarDays, FileQuestion } from "lucide-react";

const Dashboard = () => {
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
      const { count } = await supabase.from("contact_submissions").select("*", { count: "exact", head: true }).eq("status", "pending");
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
      const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "pending");
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

  const stats = [
    { label: "Bookings", value: bookingsCount ?? 0, icon: CalendarDays, color: "text-primary" },
    { label: "Pending Bookings", value: pendingBookings ?? 0, icon: Clock, color: "text-amber-500" },
    { label: "Quote Requests", value: quotesCount ?? 0, icon: FileQuestion, color: "text-accent" },
    { label: "Submissions", value: submissions ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "Pending", value: pendingCount ?? 0, icon: Clock, color: "text-amber-500" },
    { label: "Services", value: servicesCount ?? 0, icon: Wrench, color: "text-accent" },
    { label: "Gallery", value: galleryCount ?? 0, icon: Image, color: "text-accent" },
    { label: "Testimonials", value: testimonialsCount ?? 0, icon: Star, color: "text-primary" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs sm:text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} />
            </div>
            <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
