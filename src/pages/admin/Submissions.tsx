import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell>{s.service_type || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.message}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "pending" ? "secondary" : "default"}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.status === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "contacted" })}>
                        Mark Contacted
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: "pending" })}>
                        Mark Pending
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default Submissions;
