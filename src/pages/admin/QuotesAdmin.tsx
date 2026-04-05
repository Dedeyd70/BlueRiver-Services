import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed: "bg-primary/10 text-primary",
  responded: "bg-green-100 text-green-800",
  closed: "bg-muted text-muted-foreground",
};

const QuotesAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["admin-quotes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quote_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quote_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-quotes"] });
      toast({ title: "Quote request updated" });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-display font-bold text-foreground mb-6">Quote Requests</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !quotes?.length ? (
        <p className="text-muted-foreground">No quote requests yet.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-foreground">{q.name}</h3>
                  <p className="text-sm text-muted-foreground">{q.email} {q.phone && `• ${q.phone}`}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[q.status] || "bg-muted text-muted-foreground"}`}>
                  {q.status}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <p className="font-medium text-foreground">{q.service_type || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact via:</span>
                  <p className="font-medium text-foreground capitalize">{q.preferred_contact}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Submitted:</span>
                  <p className="font-medium text-foreground">{format(new Date(q.created_at), "MMM d, yyyy")}</p>
                </div>
              </div>
              {q.address && <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Address:</span> {q.address}</p>}
              <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Description:</span> {q.description}</p>
              {q.attachment_url && (
                <a href={q.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  <ExternalLink className="w-3 h-3" /> View Attachment
                </a>
              )}
              <div className="flex flex-wrap gap-2">
                {["pending", "reviewed", "responded", "closed"].filter((s) => s !== q.status).map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => updateStatus.mutate({ id: q.id, status: s })} className="capitalize">
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuotesAdmin;
