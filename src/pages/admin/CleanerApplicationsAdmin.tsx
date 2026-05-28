import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Mail, Phone, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Paginator, { PAGE_SIZE, usePagedSlice } from "@/components/admin/Paginator";

type Status = "new" | "reviewed" | "contacted" | "archived";

interface CleanerApplication {
  id: string;
  full_name: string;
  middle_name: string | null;
  email: string;
  phone: string;
  availability: string;
  experience: string;
  service_type: string;
  has_license: boolean | null;
  authorized_to_work: boolean | null;
  reference_1: string | null;
  reference_2: string | null;
  reference_3: string | null;
  personality_bio: string | null;
  message: string | null;
  status: Status;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const yesNo = (v: boolean | null) => (v === true ? "Yes" : v === false ? "No" : "—");

const statusColors: Record<Status, string> = {
  new: "bg-amber-100 text-amber-800",
  reviewed: "bg-blue-100 text-blue-800",
  contacted: "bg-green-100 text-green-800",
  archived: "bg-muted text-muted-foreground",
};

const CleanerApplicationsAdmin = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [statusFilter]);

  const { data: applications, isLoading } = useQuery({
    queryKey: ["cleaner-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleaner_applications" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CleanerApplication[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase
        .from("cleaner_applications" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaner-applications"] });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Could not update status", variant: "destructive" }),
  });

  const deleteApp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cleaner_applications" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaner-applications"] });
      toast({ title: "Application deleted" });
    },
    onError: () => toast({ title: "Could not delete", variant: "destructive" }),
  });

  const filtered = (applications ?? []).filter((a) => statusFilter === "all" || a.status === statusFilter);

  const counts = {
    all: applications?.length ?? 0,
    new: applications?.filter((a) => a.status === "new").length ?? 0,
    reviewed: applications?.filter((a) => a.status === "reviewed").length ?? 0,
    contacted: applications?.filter((a) => a.status === "contacted").length ?? 0,
    archived: applications?.filter((a) => a.status === "archived").length ?? 0,
  };

  const tabs: { key: Status | "all"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "reviewed", label: "Reviewed" },
    { key: "contacted", label: "Contacted" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">Cleaner Applications</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Review applications submitted through the Become a Cleaner page.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-muted-foreground">No applications found.</p>
      ) : (
        <>
          <div className="space-y-3">
            {usePagedSlice(filtered, page).map((a) => {
              const isOpen = !!expanded[a.id];
              return (
                <div key={a.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">{a.full_name}</h3>
                        <Badge variant="secondary" className="text-xs">{a.service_type}</Badge>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[a.status]}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Mail className="w-3 h-3" /> {a.email}
                        </a>
                        <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Phone className="w-3 h-3" /> {a.phone}
                        </a>
                        <span>{format(new Date(a.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value as Status })}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="contacted">Contacted</option>
                        <option value="archived">Archived</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded((p) => ({ ...p, [a.id]: !isOpen }))}
                      >
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete application?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes {a.full_name}'s application. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteApp.mutate(a.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="grid sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Availability</p>
                        <p className="text-foreground">{a.availability}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Experience</p>
                        <p className="text-foreground">{a.experience}</p>
                      </div>
                      {a.message && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">About</p>
                          <p className="text-foreground whitespace-pre-wrap">{a.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Paginator page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default CleanerApplicationsAdmin;
