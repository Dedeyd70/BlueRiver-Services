import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";

const CATEGORIES = ["General", "Kitchen", "Bathroom", "Living Area", "Office Cleaning", "Deep Cleaning", "Exterior"];

interface GalleryForm {
  image_url: string;
  caption: string;
  category: string;
  is_active: boolean;
}

const defaultForm: GalleryForm = { image_url: "", caption: "", category: "General", is_active: true };

const GalleryAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<GalleryForm>(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: gallery, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      if (!form.image_url) throw new Error("Please upload an image");
      const payload = {
        image_url: form.image_url,
        caption: form.caption,
        category: form.category,
        is_active: form.is_active,
        display_order: editId ? undefined : (gallery?.length ?? 0) + 1,
      };
      if (editId) {
        const { error } = await supabase.from("gallery").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("gallery").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast({ title: editId ? "Image updated" : "Image added" });
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gallery").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast({ title: "Image deleted" });
    },
  });

  const openEdit = (item: any) => {
    setEditId(item.id);
    setForm({ image_url: item.image_url, caption: item.caption || "", category: item.category || "General", is_active: item.is_active });
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Gallery</h1>
        <Button onClick={() => { setEditId(null); setForm(defaultForm); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Image
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Image" : "Add Image"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Image</label>
              <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="gallery" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Caption (optional)</label>
              <Input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Describe this image" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Visible</span>
            </div>
            <Button type="submit" className="w-full" disabled={upsert.isPending}>
              {editId ? "Update" : "Add"} Image
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !gallery?.length ? (
        <p className="text-muted-foreground">No gallery images yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {gallery.map((item) => (
            <div key={item.id} className="relative group rounded-xl overflow-hidden border border-border bg-card">
              <img src={item.image_url} alt={item.caption || "Gallery"} className="w-full h-40 object-cover" />
              {!item.is_active && (
                <span className="absolute top-2 left-2 text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Hidden</span>
              )}
              <div className="p-2">
                <p className="text-xs text-primary font-medium">{(item as any).category || "General"}</p>
                <p className="text-xs text-muted-foreground truncate">{item.caption || "No caption"}</p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => openEdit(item)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => remove.mutate(item.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GalleryAdmin;
