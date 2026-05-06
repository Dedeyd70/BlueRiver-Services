import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, ArrowRight } from "lucide-react";
import { useFocusHighlight } from "@/hooks/useFocusHighlight";
import PermissionGate from "@/components/PermissionGate";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";
import CollapsibleRecordCard from "@/components/admin/CollapsibleRecordCard";
import RecordActivityPanel, { ActivityEntry } from "@/components/admin/RecordActivityPanel";
import { useAdminUserNames } from "@/hooks/useAdminUserNames";
import ContactReplyComposer from "@/components/admin/ContactReplyComposer";

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

// Status mapping: existing column values → CRM labels
// pending→New, read→In Progress, converted→Quoted, responded→Archived
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "New" },
  { value: "read", label: "In Progress" },
  { value: "converted", label: "Quoted" },
  { value: "responded", label: "Archived" },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]));
const ARCHIVE_STATUSES = new Set(["responded", "converted"]);

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  read: "bg-blue-100 text-blue-800",
  responded: "bg-muted text-muted-foreground",
  converted: "bg-green-100 text-green-800",
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "Status changed",
  note: "Note",
  reply_sent: "Reply sent",
  converted: "Converted to quote",
};

const MessagesAdmin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get("focus");

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

  const { data: activityByContact } = useQuery({
    queryKey: ["contact-activity-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contact_activity_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, ActivityEntry[]> = {};
      (data ?? []).forEach((row: any) => {
        const detailParts: string[] = [];
        if (row.action === "status_change") {
          detailParts.push(`${STATUS_LABEL[row.previous_status] ?? row.previous_status ?? "—"} → ${STATUS_LABEL[row.new_status] ?? row.new_status ?? "—"}`);
        }
        if (row.details) detailParts.push(row.details);
        const entry: ActivityEntry = {
          id: row.id,
          action: row.action,
          notes: row.notes,
          details: detailParts.join(" • ") || null,
          actor_id: row.actor_id,
          created_at: row.created_at,
        };
        (map[row.contact_id] ||= []).push(entry);
      });
      // RecordActivityPanel renders chronologically; ensure ascending by created_at
      Object.keys(map).forEach((k) => map[k].reverse());
      return map;
    },
  });

  const { data: adminUserMap } = useAdminUserNames();
  const resolveActor = (id?: string | null): string => {
    if (!id) return "System";
    return adminUserMap?.[id] || "Admin user";
  };

  const { getRef } = useFocusHighlight(!isLoading && !!messages);

  useEffect(() => {
    if (focusId) setExpandedId(focusId);
  }, [focusId]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-contact-messages"] });
    queryClient.invalidateQueries({ queryKey: ["contact-activity-logs"] });
  };

  const changeStatus = useMutation({
    mutationFn: async ({ m, next }: { m: ContactSubmission; next: string }) => {
      if (m.status === next) return;
      const { error } = await supabase
        .from("contact_submissions")
        .update({ status: next } as any)
        .eq("id", m.id);
      if (error) throw error;
      await (supabase as any).rpc("log_contact_activity", {
        p_contact_id: m.id,
        p_action: "status_change",
        p_previous_status: m.status,
        p_new_status: next,
      });
    },
    onSuccess: () => {
      refreshAll();
      toast({ title: "Status updated." });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const addNote = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await (supabase as any).rpc("log_contact_activity", {
        p_contact_id: id,
        p_action: "note",
        p_notes: note,
      });
      if (error) throw error;
    },
    onSuccess: () => refreshAll(),
    onError: (e: Error) => toast({ title: "Could not add note", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="p-8">Loading messages...</p>;

  const all = messages ?? [];
  const active = all.filter((m) => !ARCHIVE_STATUSES.has(m.status));
  const archived = all.filter((m) => ARCHIVE_STATUSES.has(m.status));

  const renderCard = (m: ContactSubmission, readOnly: boolean) => {
    const entries = activityByContact?.[m.id] ?? [];
    const statusBadge = (
      <span
        className={`text-xs px-2 py-1 rounded-full font-medium ${
          statusColors[m.status] || "bg-muted text-muted-foreground"
        }`}
      >
        {STATUS_LABEL[m.status] ?? m.status}
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
          { label: "Status", value: STATUS_LABEL[m.status] ?? m.status },
          { label: "Submitted", value: format(new Date(m.created_at), "MMM d, yyyy") },
          { label: "Activity", value: String(entries.length) },
        ]}
      >
        {/* Original message */}
        <div className="bg-muted/30 p-3 rounded-lg text-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
          <p className="whitespace-pre-wrap">{m.message}</p>
        </div>

        {/* Status select + Convert button */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PermissionGate permission="can_manage_messages">
              <label className="text-sm font-medium">Status:</label>
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={m.status}
                onChange={(e) => changeStatus.mutate({ m, next: e.target.value })}
                disabled={changeStatus.isPending}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </PermissionGate>
            <PermissionGate permission="can_manage_messages">
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate(`/admin/quotes?prefillFromContact=${m.id}`)}
              >
                <ArrowRight className="w-4 h-4 mr-1" /> Convert to Quote
              </Button>
            </PermissionGate>
          </div>
        )}

        {/* Submission details */}
        <div className="border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground mb-2">Submission Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {[
              ["Name", m.name],
              ["Email", m.email],
              ["Phone", m.phone || "—"],
              ["Service", m.service_type || "General Inquiry"],
              ["Status", STATUS_LABEL[m.status] ?? m.status],
              ["Submitted", format(new Date(m.created_at), "MMM d, yyyy 'at' h:mm a")],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0">
                <span className="text-xs text-muted-foreground block">{label}</span>
                <span className="font-medium text-foreground text-sm break-words">{value as string}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Reply composer */}
        {!readOnly && (
          <ContactReplyComposer
            contactId={m.id}
            to={m.email}
            customerName={m.name}
            onSent={async () => {
              // Auto-bump status from New → In Progress when first reply sent
              if (m.status === "pending") {
                await changeStatus.mutateAsync({ m, next: "read" });
              } else {
                refreshAll();
              }
            }}
          />
        )}

        <RecordActivityPanel
          collapsible={false}
          readOnly={readOnly}
          entries={entries}
          resolveActor={resolveActor}
          actionLabels={ACTION_LABELS}
          permission="can_manage_messages"
          onAddNote={async (note) => addNote.mutateAsync({ id: m.id, note })}
        />

        {readOnly && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground italic bg-muted/30 inline-block px-3 py-1 rounded-md">
              Archived record — actions disabled.
            </p>
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
    </div>
  );
};

export default MessagesAdmin;
