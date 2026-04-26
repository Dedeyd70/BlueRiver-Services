import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, FileText } from "lucide-react";

const PrivacyPolicyAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-privacy-policy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("*")
        .eq("page_name", "privacy-policy")
        .eq("section_key", "main")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data?.content) {
      const c = data.content as any;
      setBody(c.body || "");
      setContactEmail(c.contact_email || "");
      setContactPhone(c.contact_phone || "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const content = { body, contact_email: contactEmail, contact_phone: contactPhone };
      if (data?.id) {
        const { data: updated, error } = await supabase.from("page_content").update({ content }).eq("id", data.id).select("id").maybeSingle();
        if (error) throw error;
        if (!updated) throw new Error("Update blocked by permissions or RLS");
      } else {
        await supabase.from("page_content").insert({ page_name: "privacy-policy", section_key: "main", content });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-privacy-policy"] });
      qc.invalidateQueries({ queryKey: ["page-content"] });
      toast({ title: "Privacy policy saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Privacy Policy</h1>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Privacy Policy Text</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={15} placeholder="Enter your privacy policy content here..." />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Contact Email (for privacy inquiries)</label>
            <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="privacy@example.com" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Contact Phone</label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 123-4567" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyAdmin;
