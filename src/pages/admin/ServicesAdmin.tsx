import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface ServiceForm {
  title: string;
  description: string;
  icon: string;
  features: string;
  price_starting: string;
  is_active: boolean;
}

const defaultForm: ServiceForm = { title: "", description: "", icon: "Sparkles", features: "", price_starting: "", is_active: true };

const ServicesAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(defaultForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: services, isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        description: form.description,
        icon: form.icon,
        features: form.features.split("\n").filter(Boolean),
        price_starting: form.price_starting || null,
        is_active: form.is_active,
        display_order: editId ? undefined : (services?.length ?? 0) + 1,
      };
      if (editId) {
        const { error } = await supabase.from("services").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      toast({ title: editId ? "Service updated" : "Service created" });
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      toast({ title: "Service deleted" });
    },
  });

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      title: s.title,
      description: s.description,
      icon: s.icon,
      features: (s.features || []).join("\n"),
      price_starting: s.price_starting || "",
      is_active: s.is_active,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Services</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Add Service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Service" : "New Service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Icon name</label>
                  <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Home, Building2, etc." />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Starting Price</label>
                  <Input value={form.price_starting} onChange={(e) => setForm({ ...form, price_starting: e.target.value })} placeholder="$99" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Features (one per line)</label>
                <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4} placeholder="Feature 1&#10;Feature 2" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <span className="text-sm">Active</span>
              </div>
              <Button type="submit" className="w-full" disabled={upsert.isPending}>
                {editId ? "Update" : "Create"} Service
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : !services?.length ? (
          <p className="text-muted-foreground">No services yet.</p>
        ) : (
          services.map((s) => (
            <div key={s.id} className="flex items-center gap-4 bg-card border border-border rounded-xl p-4">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">{s.title}</h3>
                  {!s.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Inactive</span>}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ServicesAdmin;
