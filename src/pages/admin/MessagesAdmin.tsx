import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Add this
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, CheckCircle, ArrowRight, MessageSquare, Send } from "lucide-react";

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Track which message is being responded to and the note content
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");

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

  // Flexible mutation to handle Read, Responded, or Converted
  const updateMessage = useMutation({
    mutationFn: async ({ id, status, admin_note }: { id: string; status: string; admin_note?: string }) => {
      const { error } = await supabase
        .from("contact_submissions")
        .update({
          status: status,
          // If your table has a 'notes' or 'admin_notes' column
          admin_notes: admin_note,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      toast({ title: "Update successful." });
      setActiveNoteId(null);
      setNoteContent("");
    },
    onError: (err) => {
      console.error(err);
      toast({ title: "Update failed.", description: "Check backend column names.", variant: "destructive" });
    },
  });

  const handleConvertToBooking = (m: any) => {
    // Optional: Mark as converted in DB first
    updateMessage.mutate({ id: m.id, status: "converted" });

    const params = new URLSearchParams();
    if (m.name) params.set("name", m.name);
    if (m.email) params.set("email", m.email);
    if (m.phone) params.set("phone", m.phone);
    if (m.service_type) params.set("service", m.service_type);
    navigate(`/book?${params.toString()}`);
  };

  if (isLoading) return <p className="text-muted-foreground">Loading messages...</p>;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Contact Messages</h1>
      </div>

      {!messages?.length ? (
        <p className="text-muted-foreground">No contact messages yet.</p>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <div key={m.id} className="p-5 rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-lg text-foreground">{m.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={m.status === "pending" ? "bg-amber-500" : "bg-blue-500"}>{m.status}</Badge>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(new Date(m.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg mb-4">
                {m.service_type && (
                  <p className="text-xs font-bold text-primary mb-1 uppercase italic">{m.service_type}</p>
                )}
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{m.message}</p>
              </div>

              {/* Activity Log / Admin Notes Display */}
              {m.admin_notes && (
                <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Activity Log:
                  </p>
                  <p className="text-sm text-blue-900">{m.admin_notes}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                {/* Standard Mark Read */}
                {m.status === "pending" && (
                  <Button variant="ghost" size="sm" onClick={() => updateMessage.mutate({ id: m.id, status: "read" })}>
                    <CheckCircle className="w-4 h-4 mr-1 text-green-500" /> Mark Read
                  </Button>
                )}

                {/* Respond Action */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNoteId(activeNoteId === m.id ? null : m.id)}
                >
                  <MessageSquare className="w-4 h-4 mr-1" /> {m.admin_notes ? "Edit Log" : "Log Response"}
                </Button>

                {/* Convert Action */}
                <Button variant="secondary" size="sm" onClick={() => handleConvertToBooking(m)}>
                  <ArrowRight className="w-4 h-4 mr-1" /> Convert to Booking
                </Button>
              </div>

              {/* Course of Action Input Field */}
              {activeNoteId === m.id && (
                <div className="mt-4 flex gap-2 animate-in fade-in slide-in-from-top-2">
                  <Input
                    placeholder="Describe course of action (e.g. Responded via email)..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => updateMessage.mutate({ id: m.id, status: "responded", admin_note: noteContent })}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesAdmin;
