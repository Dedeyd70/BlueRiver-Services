import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, CheckCircle, ArrowRight } from "lucide-react";

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_submissions").update({ status: "read" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      toast({ title: "Message marked as read." });
    },
    onError: () => {
      toast({ title: "Failed to mark as read.", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleConvertToBooking = (m: any) => {
    const params = new URLSearchParams();
    if (m.name) params.set("name", m.name);
    if (m.email) params.set("email", m.email);
    if (m.phone) params.set("phone", m.phone);
    if (m.service_type) params.set("service", m.service_type);
    navigate(`/book?${params.toString()}`);
  };

  if (isLoading) return <p className="text-muted-foreground">Loading messages...</p>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Contact Messages</h1>
      </div>

      {!messages?.length ? (
        <p className="text-muted-foreground">No contact messages yet.</p>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="font-semibold text-foreground">{m.name}</p>
                  <p className="text-sm text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={m.status === "pending" ? "default" : "secondary"}>
                    {m.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              </div>
              {m.service_type && (
                <p className="text-xs text-muted-foreground mb-1">Inquiry: {m.service_type}</p>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap">{m.message}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {m.status === "pending" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markRead.mutate(m.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Mark as Read
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConvertToBooking(m)}
                >
                  <ArrowRight className="w-4 h-4 mr-1" /> Convert to Booking
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesAdmin;
