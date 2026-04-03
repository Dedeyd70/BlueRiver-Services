import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Submissions = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("contact_submissions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-submissions"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-count"] });
      toast({ title: "Status updated" });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Submissions</h1>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Loading...</p>
        ) : !submissions?.length ? (
          <p className="p-6 text-muted-foreground">No submissions yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Phone</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Service</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Message</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Date</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-sm font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-sm">{s.email}</td>
                      <td className="px-4 py-3 text-sm">{s.phone || "—"}</td>
                      <td className="px-4 py-3 text-sm">{s.service_type || "—"}</td>
                      <td className="px-4 py-3 text-sm max-w-[200px] truncate">{s.message}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={s.status === "pending" ? "secondary" : "default"}>{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "pending" ? (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "contacted" })}>
                            Mark Contacted
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "pending" })}>
                            Mark Pending
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-border">
              {submissions.map((s) => (
                <div key={s.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground">{s.name}</span>
                    <Badge variant={s.status === "pending" ? "secondary" : "default"}>{s.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.email} {s.phone ? `· ${s.phone}` : ""}</p>
                  {s.service_type && <p className="text-xs text-primary">{s.service_type}</p>}
                  <p className="text-sm text-muted-foreground line-clamp-2">{s.message}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                    {s.status === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "contacted" })}>
                        Mark Contacted
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "pending" })}>
                        Mark Pending
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Submissions;
