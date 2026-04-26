import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const TermsAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  const { data: content } = useQuery({
    queryKey: ["admin-terms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("*")
        .eq("page_name", "terms-of-service")
        .eq("section_key", "main")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (content) {
      const c = content.content as any;
      setBody(c?.body || "");
    }
  }, [content]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { page_name: "terms-of-service", section_key: "main", content: { body } };
      if (content?.id) {
        const { data, error } = await supabase.from("page_content").update({ content: { body } }).eq("id", content.id).select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Update blocked by permissions or RLS");
      } else {
        const { error } = await supabase.from("page_content").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-terms"] });
      qc.invalidateQueries({ queryKey: ["page-content"] });
      toast({ title: "Terms of Service saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Terms of Service</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
        <label className="text-sm font-medium text-foreground mb-1.5 block">Terms of Service Content</label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} placeholder="Enter your terms of service here..." />
      </div>
    </div>
  );
};

export default TermsAdmin;
