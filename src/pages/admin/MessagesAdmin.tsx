import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, CheckCircle, ArrowRight, MessageSquare, Send } from "lucide-react";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import PermissionGate from "@/components/PermissionGate";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";

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
  admin_notes: string | null;
}

const ARCHIVE_STATUSES = new Set(["responded", "converted"]);

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-contact-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as ContactSubmission[]) ?? [];
    },
  });

  const { getRef } = useFocusHighlight(!isLoading && !!messages);

  // Auto-expand the focused card so deep-linked messages open immediately.
  useEffect(() => {
    if (focusId) setExpandedId(focusId);
  }, [focusId]);

  const updateMessage = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .update({ status, admin_notes } as any)
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      toast({ title: "Update successful." });
      setActiveNoteId(null);
      setNoteContent("");
    },
    onError: (err: Error) => {
      toast({ title: "Update failed.", description: err.message, variant: "destructive" });
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

  const all = messages ?? [];
  const active = all.filter((m) => !ARCHIVE_STATUSES.has(m.status));
  const archived = all.filter((m) => ARCHIVE_STATUSES.has(m.status));

  const renderCard = (m: ContactSubmission, readOnly: boolean) => {
    const isExpanded = expandedId === m.id;
    return (
      <div
        ref={getRef(m.id)}
        key={m.id}
        className={`p-5 rounded-xl border border-border bg-card shadow-sm scroll-mt-24 ${readOnly ? "opacity-90" : ""}`}
      >
        <button
          type="button"
          onClick={() => setExpandedId(isExpanded ? null : m.id)}
          className="w-full text-left"
        >
          <div className="flex justify-between items-start mb-1">
            <div className="min-w-0">
              <p className="font-semibold text-lg truncate">{m.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {m.email} {m.phone ? `· ${m.phone}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Badge variant={m.status === "pending" ? "default" : "secondary"}>{m.status}</Badge>
              <span className="text-[10px] text-muted-foreground uppercase">
                {format(new Date(m.created_at), "MMM d, h:mm a")}
              </span>
            </div>
          </div>
          <p className="text-xs text-primary uppercase font-bold mt-2">{m.service_type || "General Inquiry"}</p>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            <div className="bg-muted/30 p-3 rounded-lg text-sm">
              <p className="whitespace-pre-wrap">{m.message}</p>
            </div>

            {m.admin_notes && (
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Activity Log:
                </p>
                <p className="text-sm text-blue-900 italic">"{m.admin_notes}"</p>
              </div>
            )}

            {readOnly ? (
              <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
                Archived record — actions disabled.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                {m.status === "pending" && (
                  <PermissionGate permission="can_manage_messages">
                    <Button variant="ghost" size="sm" onClick={() => updateMessage.mutate({ id: m.id, status: "read" })}>
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500" /> Mark Read
                    </Button>
                  </PermissionGate>
                )}
                <PermissionGate permission="can_manage_messages">
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
                </PermissionGate>
                <PermissionGate permission="can_manage_messages">
                  <Button variant="secondary" size="sm" onClick={() => handleConvertToBooking(m)}>
                    <ArrowRight className="w-4 h-4 mr-1" /> Convert
                  </Button>
                </PermissionGate>
              </div>
            )}

            {activeNoteId === m.id && !readOnly && (
              <div className="mt-2 flex gap-2">
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
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Contact Messages</h1>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archived.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center italic">No active messages.</p>
          ) : (
            <>
              <div className="space-y-4">
                {usePagedSlice(active, activePage).map((m) => renderCard(m, false))}
              </div>
              <Paginator page={activePage} pageSize={PAGE_SIZE} total={active.length} onChange={setActivePage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {archived.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center italic">No archived messages.</p>
          ) : (
            <>
              <div className="space-y-4">
                {usePagedSlice(archived, archivePage).map((m) => renderCard(m, true))}
              </div>
              <Paginator page={archivePage} pageSize={PAGE_SIZE} total={archived.length} onChange={setArchivePage} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MessagesAdmin;
