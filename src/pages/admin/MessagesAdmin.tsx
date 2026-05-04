import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, CheckCircle, ArrowRight, MessageSquare } from "lucide-react";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import PermissionGate from "@/components/PermissionGate";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";
import CollapsibleRecordCard from "@/components/admin/CollapsibleRecordCard";
import RecordActivityPanel, { ActivityEntry } from "@/components/admin/RecordActivityPanel";
import { useAdminUserNames } from "@/hooks/useAdminUserNames";

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

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  read: "bg-blue-100 text-blue-800",
  responded: "bg-green-100 text-green-800",
  converted: "bg-primary/10 text-primary",
};

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);

  // Convert dialog state
  const [convertTarget, setConvertTarget] = useState<ContactSubmission | null>(null);
  const [convertService, setConvertService] = useState("");
  const [convertDescription, setConvertDescription] = useState("");

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

  // Service list (main only) for the Convert-to-Quote service select.
  const { data: services } = useQuery({
    queryKey: ["services-main-for-convert"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("title")
        .eq("is_active", true)
        .neq("service_category", "addon")
        .order("display_order");
      return (data ?? []) as { title: string }[];
    },
  });

  // Shared admin name lookup via RPC (Manager/Staff included).
  const { data: adminUserMap } = useAdminUserNames();
  // contact_submissions doesn't carry actor_id, so log entries default to "Admin user".
  const resolveActor = (id?: string | null): string => {
    if (!id) return "Admin user";
    return adminUserMap?.[id] || "Admin user";
  };

  const { getRef } = useFocusHighlight(!isLoading && !!messages);

  useEffect(() => {
    if (focusId) setExpandedId(focusId);
  }, [focusId]);

  const updateMessage = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes?: string }) => {
      const patch: any = { status };
      if (admin_notes !== undefined) patch.admin_notes = admin_notes;
      const { data, error } = await supabase
        .from("contact_submissions")
        .update(patch)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      toast({ title: "Update successful." });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed.", description: err.message, variant: "destructive" });
    },
  });

  const addNote = (m: ContactSubmission) => {
    const next = (noteDraft[m.id] || "").trim();
    if (!next) return;
    // Append to existing admin_notes (single text column → keep entries separated by line break + timestamp).
    const stamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
    const prefix = m.admin_notes ? `${m.admin_notes}\n---\n` : "";
    const composed = `${prefix}[${stamp}] ${next}`;
    updateMessage.mutate(
      { id: m.id, status: m.status === "pending" ? "read" : m.status, admin_notes: composed },
      {
        onSuccess: () => setNoteDraft((p) => ({ ...p, [m.id]: "" })),
      }
    );
  };

  const openConvert = (m: ContactSubmission) => {
    setConvertTarget(m);
    setConvertService(m.service_type || "");
    setConvertDescription(m.message || "");
  };

  const convertToQuote = useMutation({
    mutationFn: async () => {
      if (!convertTarget) throw new Error("No submission selected");
      if (!convertDescription.trim()) throw new Error("Description is required");
      const { error: insertErr } = await supabase.from("quote_requests").insert({
        name: convertTarget.name,
        email: convertTarget.email,
        phone: convertTarget.phone,
        service_type: convertService || null,
        description: convertDescription.trim(),
        status: "requested",
        consent_given: true,
        preferred_contact: "email",
      } as any);
      if (insertErr) throw insertErr;
      const { error: updErr } = await supabase
        .from("contact_submissions")
        .update({ status: "converted" } as any)
        .eq("id", convertTarget.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-quotes"] });
      toast({ title: "Submission converted to quote request." });
      setConvertTarget(null);
      setConvertService("");
      setConvertDescription("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="p-8">Loading messages...</p>;

  const all = messages ?? [];
  const active = all.filter((m) => !ARCHIVE_STATUSES.has(m.status));
  const archived = all.filter((m) => ARCHIVE_STATUSES.has(m.status));

  // Parse stored admin_notes back into stamped entries for log rendering.
  const parseLogEntries = (raw: string | null): { stamp: string | null; text: string }[] => {
    if (!raw) return [];
    return raw.split(/\n---\n/).map((chunk) => {
      const m = chunk.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
      return m ? { stamp: m[1], text: m[2] } : { stamp: null, text: chunk };
    });
  };

  const renderCard = (m: ContactSubmission, readOnly: boolean) => {
    const entries = parseLogEntries(m.admin_notes);
    const statusBadge = (
      <span
        className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
          statusColors[m.status] || "bg-muted text-muted-foreground"
        }`}
      >
        {m.status}
      </span>
    );

    return (
      <CollapsibleRecordCard
        key={m.id}
        innerRef={getRef(m.id)}
        title={m.name}
        subtitle={`${m.email}${m.phone ? ` • ${m.phone}` : ""}`}
        statusBadge={statusBadge}
        readOnly={readOnly}
        expanded={expandedId === m.id}
        onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
        summary={[
          { label: "Service", value: m.service_type || "General" },
          { label: "Status", value: <span className="capitalize">{m.status}</span> },
          { label: "Submitted", value: format(new Date(m.created_at), "MMM d, yyyy") },
          { label: "Notes", value: String(entries.length) },
        ]}
      >
        {/* Original message */}
        <div className="bg-muted/30 p-3 rounded-lg text-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
          <p className="whitespace-pre-wrap">{m.message}</p>
        </div>

        {/* Submission details — labelled key/value list */}
        <div className="border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground mb-2">Submission Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              ["Name", m.name],
              ["Email", m.email],
              ["Phone", m.phone || "—"],
              ["Service", m.service_type || "General Inquiry"],
              ["Status", m.status],
              ["Submitted", format(new Date(m.created_at), "MMM d, yyyy 'at' h:mm a")],
              ["Last updated", format(new Date(m.updated_at), "MMM d, yyyy 'at' h:mm a")],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0">
                <span className="text-xs text-muted-foreground block">{label}</span>
                <span className="font-medium text-foreground text-sm break-words">{value as string}</span>
              </div>
            ))}
          </div>
        </div>

        <RecordActivityPanel
          collapsible={false}
          readOnly={readOnly}
          entries={entries.map((e, i): ActivityEntry => ({
            id: `${m.id}-${i}`,
            action: "note",
            notes: e.text,
            created_at: e.stamp ? new Date(e.stamp).toISOString() : m.updated_at,
          }))}
          resolveActor={() => "Admin user"}
          permission="can_manage_messages"
          onAddNote={async (note) => {
            const stamp = format(new Date(), "MMM d, yyyy 'at' h:mm a");
            const prefix = m.admin_notes ? `${m.admin_notes}\n---\n` : "";
            const composed = `${prefix}[${stamp}] ${note}`;
            updateMessage.mutate({
              id: m.id,
              status: m.status === "pending" ? "read" : m.status,
              admin_notes: composed,
            });
          }}
        />

        {/* Actions */}
        {readOnly ? (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
              Archived record — actions disabled.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            {m.status === "pending" && (
              <PermissionGate permission="can_manage_messages">
                <Button variant="outline" size="sm" onClick={() => updateMessage.mutate({ id: m.id, status: "read" })}>
                  <CheckCircle className="w-4 h-4 mr-1 text-green-500" /> Mark Read
                </Button>
              </PermissionGate>
            )}
            <PermissionGate permission="can_manage_messages">
              <Button variant="outline" size="sm" onClick={() => updateMessage.mutate({ id: m.id, status: "responded" })}>
                Mark Responded
              </Button>
            </PermissionGate>
            <PermissionGate permission="can_manage_messages">
              <Button variant="default" size="sm" onClick={() => openConvert(m)}>
                <ArrowRight className="w-4 h-4 mr-1" /> Convert to Quote
              </Button>
            </PermissionGate>
          </div>
        )}
      </CollapsibleRecordCard>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24">
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
              <div className="space-y-3">
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
              <div className="space-y-3">
                {usePagedSlice(archived, archivePage).map((m) => renderCard(m, true))}
              </div>
              <Paginator page={archivePage} pageSize={PAGE_SIZE} total={archived.length} onChange={setArchivePage} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Convert Submission to Quote dialog */}
      <Dialog open={!!convertTarget} onOpenChange={(o) => !o && setConvertTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convert Submission to Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input value={convertTarget?.name || ""} readOnly className="bg-muted/40" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <Input value={convertTarget?.email || ""} readOnly className="bg-muted/40" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={convertTarget?.phone || ""} readOnly className="bg-muted/40" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Service</label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                value={convertService}
                onChange={(e) => setConvertService(e.target.value)}
              >
                <option value="">— Select a service —</option>
                {(services ?? []).map((s) => (
                  <option key={s.title} value={s.title}>{s.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description *</label>
              <Textarea
                rows={4}
                value={convertDescription}
                onChange={(e) => setConvertDescription(e.target.value)}
                placeholder="Quote scope / customer request…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>Cancel</Button>
            <Button
              onClick={() => convertToQuote.mutate()}
              disabled={convertToQuote.isPending || !convertDescription.trim()}
            >
              Create Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MessagesAdmin;
