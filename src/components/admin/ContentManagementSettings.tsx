import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Pencil, Trash2, Plus, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Faq = { id: string; question: string; answer: string; display_order: number; is_active: boolean };
type Review = { id: string; customer_name: string; rating: number; comment: string | null; is_public: boolean; created_at: string };

const ContentManagementSettings = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Faq> | null>(null);

  const { data: faqs } = useQuery({
    queryKey: ["admin-faqs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faqs").select("*").order("display_order");
      if (error) throw error;
      return (data ?? []) as Faq[];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

  const saveFaq = useMutation({
    mutationFn: async (f: Partial<Faq>) => {
      if (f.id) {
        const { error } = await supabase.from("faqs").update({
          question: f.question, answer: f.answer, display_order: f.display_order ?? 0, is_active: f.is_active ?? true,
        }).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("faqs").insert({
          question: f.question || "", answer: f.answer || "", display_order: f.display_order ?? 0, is_active: f.is_active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      qc.invalidateQueries({ queryKey: ["public-faqs"] });
      toast({ title: "Saved" });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faqs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-faqs"] });
      qc.invalidateQueries({ queryKey: ["public-faqs"] });
      toast({ title: "Deleted" });
    },
  });

  const togglePublic = useMutation({
    mutationFn: async ({ id, is_public }: { id: string; is_public: boolean }) => {
      const { error } = await supabase.from("reviews").update({ is_public }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      qc.invalidateQueries({ queryKey: ["public-reviews"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Tabs defaultValue="faqs" className="space-y-4">
      <TabsList>
        <TabsTrigger value="faqs">FAQs</TabsTrigger>
        <TabsTrigger value="reviews">Customer Reviews</TabsTrigger>
      </TabsList>

      <TabsContent value="faqs" className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ is_active: true, display_order: (faqs?.length ?? 0) + 1 })}>
            <Plus className="w-4 h-4 mr-2" /> New FAQ
          </Button>
        </div>

        {editing && (
          <Card className="p-4 space-y-3">
            <div>
              <Label>Question</Label>
              <Input value={editing.question || ""} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
            </div>
            <div>
              <Label>Answer</Label>
              <Textarea rows={4} value={editing.answer || ""} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
            </div>
            <div className="flex gap-4 items-center">
              <div>
                <Label>Order</Label>
                <Input type="number" className="w-24" value={editing.display_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveFaq.mutate(editing)} disabled={saveFaq.isPending}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          {faqs?.map((f) => (
            <Card key={f.id} className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">{f.question} {!f.is_active && <span className="text-xs text-muted-foreground">(hidden)</span>}</p>
                <p className="text-sm text-muted-foreground mt-1">{f.answer}</p>
              </div>
              <div className="flex gap-2">
                <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this FAQ?")) deleteFaq.mutate(f.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
          {faqs?.length === 0 && <p className="text-sm text-muted-foreground">No FAQs yet.</p>}
        </div>
      </TabsContent>

      <TabsContent value="reviews" className="space-y-2">
        {reviews?.map((r) => (
          <Card key={r.id} className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{r.customer_name}</p>
                <div className="flex">
                  {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-primary text-primary" />)}
                </div>
              </div>
              {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Public</Label>
              <Switch checked={r.is_public} onCheckedChange={(v) => togglePublic.mutate({ id: r.id, is_public: v })} />
            </div>
          </Card>
        ))}
        {reviews?.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
      </TabsContent>
    </Tabs>
  );
};

export default ContentManagementSettings;
