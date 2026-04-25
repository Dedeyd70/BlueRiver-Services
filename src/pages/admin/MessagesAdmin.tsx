import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, CheckCircle, ArrowRight, MessageSquare, Send } from "lucide-react";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import HasPermission from "@/components/HasPermission";

// 1. Interface matches your Supabase screenshot exactly
interface ContactSubmission {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  service_type: string | null;
  message: string;
  status: string;
  admin_notes: string | null; // Matches plural in screenshot
}

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

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
      // Double casting to ensure TS recognizes admin_notes
      return (data as unknown as ContactSubmission[]) ?? [];
    },
  });

  const { getRef } = useFocusHighlight(!isLoading && !!messages);

  const updateMessage = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      // Use 'as any' to force the update through regardless of local type cache
      const { error } = await supabase
        .from("contact_submissions")
        .update({
          status: status,
          admin_notes: admin_notes, // MUST be plural to match your DB
        } as any)
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
      console.error("Supabase Error:", err);
      toast({
        title: "Update failed.",
        description: "Check console for details.",
        variant: "destructive",
      });
    },
  });

  const handleConvertToBooking = (m: ContactSubmission) => {
    updateMessage.mutate({ id: m.id, status: "converted" });
    const params = new URLSearchParams({
      name: m.name || "",
      email: m.email || "",
      phone: m.phone || "",
      service: m.service_type || "",
    });
    navigate(`/book?${params.toString()}`);
  };

  if (isLoading) return <p className="p-8">Loading messages...</p>;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Contact Messages</h1>
      </div>

      {!messages?.length ? (
        <p className="text-muted-foreground">No messages found.</p>
      ) : (
        <div className="space-y-4">
          {messages.map((m: ContactSubmission) => (
            <div ref={getRef(m.id)} key={m.id} className="p-5 rounded-xl border border-border bg-card shadow-sm scroll-mt-24">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-lg">{m.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.email} {m.phone ? `· ${m.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={m.status === "pending" ? "default" : "secondary"}>{m.status}</Badge>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {format(new Date(m.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg mb-4 text-sm">
                <p className="text-xs font-bold text-primary uppercase mb-1">{m.service_type || "General Inquiry"}</p>
                <p className="whitespace-pre-wrap">{m.message}</p>
              </div>

              {/* Activity Log Display */}
              {m.admin_notes && (
                <div className="mb-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Activity Log:
                  </p>
                  <p className="text-sm text-blue-900 italic">"{m.admin_notes}"</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                <HasPermission permission="can_manage_messages">
                  {m.status === "pending" && (
                    <Button variant="ghost" size="sm" onClick={() => updateMessage.mutate({ id: m.id, status: "read" })}>
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" /> Mark Read
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveNoteId(activeNoteId === m.id ? null : m.id);
                      setNoteContent(m.admin_notes || "");
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" /> Log Response
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleConvertToBooking(m)}>
                    <ArrowRight className="w-4 h-4 mr-1" /> Convert
                  </Button>
                </HasPermission>
              </div>

              {activeNoteId === m.id && (
                <div className="mt-4 flex gap-2">
                  <Input
                    placeholder="Describe action taken..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      updateMessage.mutate({
                        id: m.id,
                        status: "responded",
                        admin_notes: noteContent,
                      })
                    }
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
