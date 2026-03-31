import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Wrench, Star, Clock } from "lucide-react";

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

  const stats = [
    { label: "Total Submissions", value: submissions ?? 0, icon: MessageSquare, color: "text-primary" },
    { label: "Pending", value: pendingCount ?? 0, icon: Clock, color: "text-amber-500" },
    { label: "Services", value: servicesCount ?? 0, icon: Wrench, color: "text-accent" },
    { label: "Testimonials", value: testimonialsCount ?? 0, icon: Star, color: "text-primary" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-3xl font-display font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
