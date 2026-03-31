import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface TestimonialForm {
  author_name: string;
  author_role: string;
  content: string;
  rating: number;
  is_active: boolean;
}

const defaultForm: TestimonialForm = { author_name: "", author_role: "", content: "", rating: 5, is_active: true };

const TestimonialsAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TestimonialForm>(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("testimonials").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        author_name: form.author_name,
        author_role: form.author_role,
        content: form.content,
        rating: form.rating,
        is_active: form.is_active,
        display_order: editId ? undefined : (testimonials?.length ?? 0) + 1,
      };
      if (editId) {
        const { error } = await supabase.from("testimonials").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("testimonials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      toast({ title: editId ? "Testimonial updated" : "Testimonial created" });
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("testimonials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-testimonials"] });
      toast({ title: "Testimonial deleted" });
    },
  });

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({ author_name: t.author_name, author_role: t.author_role, content: t.content, rating: t.rating, is_active: t.is_active });
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Testimonials</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); setForm(defaultForm); setDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Testimonial</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Testimonial" : "New Testimonial"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Author Name</label>
                  <Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Role</label>
                  <Input value={form.author_role} onChange={(e) => setForm({ ...form, author_role: e.target.value })} placeholder="Homeowner" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Review</label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setForm({ ...form, rating: n })}>
                      <Star className={`w-5 h-5 ${n <= form.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">Active</span>
              </div>
              <Button type="submit" className="w-full" disabled={upsert.isPending}>
                {editId ? "Update" : "Create"} Testimonial
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !testimonials?.length ? (
          <p className="text-muted-foreground">No testimonials yet.</p>
        ) : (
          testimonials.map((t) => (
            <div key={t.id} className="flex items-start gap-4 bg-card border border-border rounded-xl p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-foreground">{t.author_name}</h3>
                  <span className="text-xs text-muted-foreground">— {t.author_role}</span>
                  {!t.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Inactive</span>}
                </div>
                <div className="flex gap-0.5 mb-1">
                  {Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-primary text-primary" />)}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{t.content}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TestimonialsAdmin;
