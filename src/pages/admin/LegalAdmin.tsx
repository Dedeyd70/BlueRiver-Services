import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Scale } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const pages = [
  { key: "liability-disclaimer", label: "Liability Disclaimer" },
  { key: "cancellation-policy", label: "Cancellation Policy" },
];

const LegalAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState(pages[0].key);
  const [body, setBody] = useState("");

  const { data: content } = useQuery({
    queryKey: ["admin-legal", tab],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_content")
        .select("*")
        .eq("page_name", tab)
        .eq("section_key", "main")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setBody((content?.content as any)?.body || "");
  }, [content]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { page_name: tab, section_key: "main", content: { body } };
      if (content?.id) {
        const { error } = await supabase.from("page_content").update({ content: { body } }).eq("id", content.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("page_content").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-legal"] });
      qc.invalidateQueries({ queryKey: ["page-content"] });
      toast({ title: "Saved successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Legal Pages</h1>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          {pages.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
          ))}
        </TabsList>
        {pages.map((p) => (
          <TabsContent key={p.key} value={p.key}>
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
              <label className="text-sm font-medium text-foreground mb-1.5 block">{p.label} Content</label>
              <p className="text-xs text-muted-foreground mb-2">Use blank lines between paragraphs. Short lines in title case will be auto-formatted as bold headings.</p>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} placeholder={`Enter your ${p.label.toLowerCase()} here...`} />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default LegalAdmin;
