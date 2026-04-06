import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";

interface BAForm {
  before_image_url: string;
  after_image_url: string;
  caption: string;
  is_active: boolean;
}

const defaultForm: BAForm = { before_image_url: "", after_image_url: "", caption: "", is_active: true };

const BeforeAfterAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BAForm>(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-before-after"],
    queryFn: async () => {
      const { data, error } = await supabase.from("before_after_images").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.before_image_url || !form.after_image_url) throw new Error("Please upload both images");
      const payload = {
        before_image_url: form.before_image_url,
        after_image_url: form.after_image_url,
        caption: form.caption,
        is_active: form.is_active,
        display_order: editId ? undefined : (items?.length ?? 0) + 1,
      };
      if (editId) {
        const { error } = await supabase.from("before_after_images").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("before_after_images").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-before-after"] });
      toast({ title: editId ? "Updated" : "Added" });
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("before_after_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-before-after"] });
      toast({ title: "Deleted" });
    },
  });

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({ before_image_url: item.before_image_url, after_image_url: item.after_image_url, caption: item.caption || "", is_active: item.is_active });
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Before & After</h1>
        <Button onClick={() => { setEditId(null); setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Pair
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "Add"} Before & After</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Before Image</label>
              <ImageUpload value={form.before_image_url} onChange={(url) => setForm({ ...form, before_image_url: url })} folder="before-after" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">After Image</label>
              <ImageUpload value={form.after_image_url} onChange={(url) => setForm({ ...form, after_image_url: url })} folder="before-after" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Caption (optional)</label>
              <Input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Kitchen deep clean" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Visible</span>
            </div>
            <Button type="submit" className="w-full" disabled={upsert.isPending}>
              {editId ? "Update" : "Add"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !items?.length ? (
        <p className="text-muted-foreground">No before & after images yet.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.caption || "Untitled"}</p>
                  {!item.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Hidden</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(item)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => remove.mutate(item.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Before</p>
                  <img src={item.before_image_url} alt="Before" className="w-full h-32 object-cover rounded-lg" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">After</p>
                  <img src={item.after_image_url} alt="After" className="w-full h-32 object-cover rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BeforeAfterAdmin;
