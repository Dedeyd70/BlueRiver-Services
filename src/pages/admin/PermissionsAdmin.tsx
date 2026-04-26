import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ShieldCheck } from "lucide-react";
import { usePermissionRegistry, type PermissionEntry } from "@/hooks/usePermissions";

const PermissionsAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: perms, isLoading } = usePermissionRegistry();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionEntry | null>(null);
  const [keyVal, setKeyVal] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const openCreate = () => {
    setEditing(null);
    setKeyVal("");
    setLabel("");
    setDescription("");
    setDialogOpen(true);
  };

  const openEdit = (p: PermissionEntry) => {
    setEditing(p);
    setKeyVal(p.key);
    setLabel(p.label);
    setDescription(p.description ?? "");
    setDialogOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (!keyVal.trim() || !label.trim()) throw new Error("Key and label are required");
      const safeKey = keyVal.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const payload = { key: safeKey, label: label.trim(), description: description.trim() || null };
      if (editing) {
        const { data, error } = await supabase
          .from("permission_registry" as any)
          .update(payload)
          .eq("id", editing.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Update blocked by permissions or RLS");
      } else {
        const { error } = await supabase.from("permission_registry" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-registry"] });
      toast({ title: editing ? "Permission updated" : "Permission added" });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("permission_registry" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permission-registry"] });
      toast({ title: "Permission removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Permissions</h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Permission
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Permissions defined here can be granted to individual users from the User Management page.
        Super Admins always have all permissions.
      </p>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !perms?.length ? (
        <p className="text-muted-foreground">No permissions defined yet.</p>
      ) : (
        <div className="space-y-2">
          {perms.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{p.label}</p>
                <p className="text-xs font-mono text-muted-foreground">{p.key}</p>
                {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(p)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => remove.mutate(p.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Permission" : "Add Permission"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Key *</label>
              <Input
                value={keyVal}
                onChange={(e) => setKeyVal(e.target.value)}
                placeholder="can_manage_socials"
                required
                disabled={!!editing}
              />
              <p className="text-xs text-muted-foreground mt-1">Lowercase, underscores only. Used in code.</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Label *</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Manage Social Links" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Saving..." : editing ? "Save Changes" : "Add Permission"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionsAdmin;
