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
import ImageUpload from "@/components/ImageUpload";

interface ServiceForm {
  title: string;
  description: string;
  icon: string;
  features: string;
  price_starting: string;
  is_active: boolean;
  image_url: string;
  service_category: string;
}

const defaultForm: ServiceForm = { title: "", description: "", icon: "Sparkles", features: "", price_starting: "", is_active: true, image_url: "", service_category: "main" };

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
        image_url: form.image_url,
        service_category: form.service_category,
        display_order: editId ? undefined : (services?.length ?? 0) + 1,
      };
      if (editId) {
        const { data, error } = await supabase.from("services").update(payload).eq("id", editId).select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Update blocked by permissions or RLS");
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
        // Auto-create matching service_type for main services so it appears in Pricing Settings.
        if (form.service_category === "main") {
          await (supabase as any)
            .from("service_types")
            .upsert({ name: form.title, base_price: 0 }, { onConflict: "name" });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["admin-service-types"] });
      toast({
        title: editId ? "Service updated" : "Service created",
        description: !editId && form.service_category === "main"
          ? "Configure pricing in Settings → Pricing."
          : undefined,
      });
      setDialogOpen(false);
      setEditId(null);
      setForm(defaultForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Look up the service first so we can also clean its matching service_types row
      const svc = (services ?? []).find((s) => s.id === id) as any;
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
      // For main services, also delete the linked service_types row.
      // FK ON DELETE CASCADE will auto-remove related service_fields & service_pricing_rules.
      if (svc && svc.service_category === "main" && svc.title) {
        await (supabase as any).from("service_types").delete().ilike("name", svc.title);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["admin-service-types"] });
      qc.invalidateQueries({ queryKey: ["public-services"] });
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
      image_url: s.image_url || "",
      service_category: s.service_category || "main",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const mainServices = (services ?? []).filter((s) => (s as any).service_category !== "addon");
  const addons = (services ?? []).filter((s) => (s as any).service_category === "addon");

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Services</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Add Service</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Service" : "New Service"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Category</label>
                <select
                  value={form.service_category}
                  onChange={(e) => setForm({ ...form, service_category: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="main">Main Service</option>
                  <option value="addon">Add-On</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Service Image</label>
                <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} folder="services" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Icon name</label>
                  <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Home, Building2, etc." />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{form.service_category === "addon" ? "Price" : "Starting Price"}</label>
                  <Input value={form.price_starting} onChange={(e) => setForm({ ...form, price_starting: e.target.value })} placeholder={form.service_category === "addon" ? "$50" : "$200"} />
                </div>
              </div>
              {form.service_category === "main" && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Features (one per line)</label>
                  <Textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} rows={4} placeholder={"Feature 1\nFeature 2"} />
                </div>
              )}
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

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="space-y-8">
          {/* Main Services */}
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-3">Main Services</h2>
            {mainServices.length === 0 ? (
              <p className="text-muted-foreground text-sm">No main services yet.</p>
            ) : (
              <div className="space-y-3">
                {mainServices.map((s) => (
                  <ServiceRow key={s.id} s={s} onEdit={openEdit} onDelete={(id) => remove.mutate(id)} />
                ))}
              </div>
            )}
          </div>

          {/* Add-Ons */}
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-3">Add-Ons</h2>
            {addons.length === 0 ? (
              <p className="text-muted-foreground text-sm">No add-ons yet.</p>
            ) : (
              <div className="space-y-3">
                {addons.map((s) => (
                  <ServiceRow key={s.id} s={s} onEdit={openEdit} onDelete={(id) => remove.mutate(id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ServiceRow = ({ s, onEdit, onDelete }: { s: any; onEdit: (s: any) => void; onDelete: (id: string) => void }) => (
  <div className="flex items-center gap-3 sm:gap-4 bg-card border border-border rounded-xl p-3 sm:p-4">
    <GripVertical className="w-4 h-4 text-muted-foreground hidden sm:block" />
    {s.image_url && (
      <img src={s.image_url} alt={s.title} className="w-12 h-12 rounded-lg object-cover hidden sm:block" />
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="font-medium text-foreground truncate">{s.title}</h3>
        {s.price_starting && <span className="text-xs text-primary font-medium">{s.price_starting}</span>}
        {!s.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">Inactive</span>}
      </div>
      <p className="text-sm text-muted-foreground line-clamp-1">{s.description}</p>
    </div>
    <Button variant="ghost" size="icon" onClick={() => onEdit(s)}><Pencil className="w-4 h-4" /></Button>
    <Button variant="ghost" size="icon" onClick={() => onDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
  </div>
);

export default ServicesAdmin;
