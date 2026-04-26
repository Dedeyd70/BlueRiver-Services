import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Image as ImageIcon, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImageUpload from "@/components/ImageUpload";

type UploadMode = "single" | "before-after";

interface SingleForm {
  image_url: string;
  caption: string;
  category: string;
  is_active: boolean;
}

interface BAForm {
  before_url: string;
  after_url: string;
  caption: string;
  category: string;
  is_active: boolean;
}

const defaultSingle: SingleForm = { image_url: "", caption: "", category: "", is_active: true };
const defaultBA: BAForm = { before_url: "", after_url: "", caption: "", category: "", is_active: true };

const GalleryAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("single");
  const [singleForm, setSingleForm] = useState<SingleForm>(defaultSingle);
  const [baForm, setBaForm] = useState<BAForm>(defaultBA);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("All");

  const { data: services } = useQuery({
    queryKey: ["admin-services-list"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("id, title").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const serviceCategories = (services ?? []).map((s) => s.title);

  const { data: gallery, isLoading } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Group before/after pairs
  const groups: Record<string, { before?: any; after?: any; caption?: string }> = {};
  const standaloneItems: any[] = [];
  (gallery ?? []).forEach((item) => {
    if (item.image_type === "single" || !item.group_id) {
      standaloneItems.push(item);
    } else {
      if (!groups[item.group_id]) groups[item.group_id] = {};
      if (item.image_type === "before") groups[item.group_id].before = item;
      if (item.image_type === "after") groups[item.group_id].after = item;
      if (item.caption) groups[item.group_id].caption = item.caption;
    }
  });

  const baPairs = Object.entries(groups).filter(([, g]) => g.before && g.after);

  const filteredStandalone = filterCategory === "All" ? standaloneItems : standaloneItems.filter((i) => i.category === filterCategory);
  const filteredBA = filterCategory === "All" ? baPairs : baPairs.filter(([, g]) => g.before?.category === filterCategory || g.after?.category === filterCategory);

  const addSingle = useMutation({
    mutationFn: async () => {
      if (!singleForm.image_url) throw new Error("Please upload an image");
      if (!singleForm.category) throw new Error("Please select a service category");
      const { error } = await supabase.from("gallery").insert({
        image_url: singleForm.image_url,
        caption: singleForm.caption,
        category: singleForm.category,
        is_active: singleForm.is_active,
        image_type: "single" as any,
        display_order: (gallery?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast({ title: "Image added" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addBA = useMutation({
    mutationFn: async () => {
      if (!baForm.before_url || !baForm.after_url) throw new Error("Upload both images");
      if (!baForm.category) throw new Error("Please select a service category");
      const group_id = crypto.randomUUID();
      const order = (gallery?.length ?? 0) + 1;
      const { error } = await supabase.from("gallery").insert([
        { image_url: baForm.before_url, caption: baForm.caption, category: baForm.category, is_active: baForm.is_active, image_type: "before" as any, group_id, display_order: order },
        { image_url: baForm.after_url, caption: baForm.caption, category: baForm.category, is_active: baForm.is_active, image_type: "after" as any, group_id, display_order: order + 1 },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast({ title: "Before/After pair added" });
      closeDialog();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateSingle = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { data, error } = await supabase.from("gallery").update({
        image_url: singleForm.image_url,
        caption: singleForm.caption,
        category: singleForm.category,
        is_active: singleForm.is_active,
      }).eq("id", editId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast({ title: "Image updated" });
      closeDialog();
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
      toast({ title: "Deleted" });
    },
  });

  const removeGroup = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("gallery").delete().eq("group_id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gallery"] });
      toast({ title: "Before/After pair deleted" });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setSingleForm(defaultSingle);
    setBaForm(defaultBA);
    setUploadMode("single");
  };

  const openEditSingle = (item: any) => {
    setEditId(item.id);
    setSingleForm({ image_url: item.image_url, caption: item.caption || "", category: item.category || "", is_active: item.is_active });
    setUploadMode("single");
    setDialogOpen(true);
  };

  const allCategories = ["All", ...new Set((gallery ?? []).map((i) => i.category).filter(Boolean))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Gallery & Media</h1>
        <Button onClick={() => { closeDialog(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Media
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat as string)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Image" : "Add Media"}</DialogTitle>
          </DialogHeader>

          {!editId && (
            <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as UploadMode)} className="mb-4">
              <TabsList className="w-full">
                <TabsTrigger value="single" className="flex-1 gap-2"><ImageIcon className="w-4 h-4" /> Single Image</TabsTrigger>
                <TabsTrigger value="before-after" className="flex-1 gap-2"><Layers className="w-4 h-4" /> Before / After</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {(uploadMode === "single" || editId) ? (
            <form onSubmit={(e) => { e.preventDefault(); editId ? updateSingle.mutate() : addSingle.mutate(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Image</label>
                <ImageUpload value={singleForm.image_url} onChange={(url) => setSingleForm({ ...singleForm, image_url: url })} folder="gallery" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Service Category</label>
                <Select value={singleForm.category} onValueChange={(v) => setSingleForm({ ...singleForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {serviceCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Caption (optional)</label>
                <Input value={singleForm.caption} onChange={(e) => setSingleForm({ ...singleForm, caption: e.target.value })} placeholder="Describe this image" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={singleForm.is_active} onCheckedChange={(v) => setSingleForm({ ...singleForm, is_active: v })} />
                <span className="text-sm">Visible</span>
              </div>
              <Button type="submit" className="w-full" disabled={addSingle.isPending || updateSingle.isPending}>
                {editId ? "Update" : "Add"} Image
              </Button>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); addBA.mutate(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Before Image</label>
                <ImageUpload value={baForm.before_url} onChange={(url) => setBaForm({ ...baForm, before_url: url })} folder="gallery" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">After Image</label>
                <ImageUpload value={baForm.after_url} onChange={(url) => setBaForm({ ...baForm, after_url: url })} folder="gallery" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Service Category</label>
                <Select value={baForm.category} onValueChange={(v) => setBaForm({ ...baForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {serviceCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Caption (optional)</label>
                <Input value={baForm.caption} onChange={(e) => setBaForm({ ...baForm, caption: e.target.value })} placeholder="Project description" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={baForm.is_active} onCheckedChange={(v) => setBaForm({ ...baForm, is_active: v })} />
                <span className="text-sm">Visible</span>
              </div>
              <Button type="submit" className="w-full" disabled={addBA.isPending}>
                Add Before / After Pair
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-8">
          {/* Before/After pairs */}
          {filteredBA.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2"><Layers className="w-4 h-4" /> Before & After Projects</h2>
              <div className="space-y-4">
                {filteredBA.map(([groupId, g]) => (
                  <div key={groupId} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{g.caption || "Untitled"}</p>
                        <p className="text-xs text-primary">{g.before?.category}</p>
                        {!g.before?.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Hidden</span>}
                      </div>
                      <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => removeGroup.mutate(groupId)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Before</p>
                        <img src={g.before?.image_url} alt="Before" className="w-full h-32 object-cover rounded-lg" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">After</p>
                        <img src={g.after?.image_url} alt="After" className="w-full h-32 object-cover rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standalone images */}
          {filteredStandalone.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Gallery Images</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredStandalone.map((item) => (
                  <div key={item.id} className="relative group rounded-xl overflow-hidden border border-border bg-card">
                    <img src={item.image_url} alt={item.caption || "Gallery"} className="w-full h-40 object-cover" />
                    {!item.is_active && (
                      <span className="absolute top-2 left-2 text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Hidden</span>
                    )}
                    <div className="p-2">
                      <p className="text-xs text-primary font-medium">{item.category || "Uncategorized"}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.caption || "No caption"}</p>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => openEditSingle(item)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button variant="secondary" size="icon" className="w-7 h-7" onClick={() => remove.mutate(item.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!filteredStandalone.length && !filteredBA.length && (
            <p className="text-muted-foreground">No gallery images yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default GalleryAdmin;
