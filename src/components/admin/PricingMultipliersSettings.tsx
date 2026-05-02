import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MultiplierRow {
  id: string;
  service_type_id: string | null;
  axis: string;
  key: string;
  modifier_type: string | null;
  value: number;
  display_label: string | null;
  is_active: boolean | null;
}

interface FormState {
  service_type_id: string; // "" means global
  axis: string;
  key: string;
  modifier_type: "flat_amount" | "percent";
  value: string;
  display_label: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  service_type_id: "",
  axis: "condition",
  key: "",
  modifier_type: "flat_amount",
  value: "0",
  display_label: "",
  is_active: true,
};

const PricingMultipliersSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MultiplierRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: serviceTypes } = useQuery({
    queryKey: ["admin-service-types-mp"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_types")
        .select("id,name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-pricing-multipliers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pricing_multipliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MultiplierRow[];
    },
  });

  const serviceName = (id: string | null) =>
    !id ? "Global" : (serviceTypes ?? []).find((s: any) => s.id === id)?.name || "Unknown";

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: MultiplierRow) => {
    setEditing(row);
    setForm({
      service_type_id: row.service_type_id ?? "",
      axis: row.axis ?? "",
      key: row.key ?? "",
      modifier_type: (row.modifier_type as any) === "percent" ? "percent" : "flat_amount",
      value: String(row.value ?? 0),
      display_label: row.display_label ?? "",
      is_active: row.is_active !== false,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        service_type_id: form.service_type_id || null,
        axis: form.axis.trim(),
        key: form.key.trim(),
        modifier_type: form.modifier_type,
        value: Number(form.value) || 0,
        display_label: form.display_label.trim() || null,
        is_active: form.is_active,
      };
      if (!payload.axis || !payload.key) {
        throw new Error("Axis and Key are required.");
      }
      if (editing) {
        const { error } = await (supabase as any)
          .from("pricing_multipliers")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("pricing_multipliers")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-multipliers"] });
      qc.invalidateQueries({ queryKey: ["pricing-multipliers"] });
      qc.invalidateQueries({ queryKey: ["public-pricing-multipliers"] });
      toast({ title: editing ? "Multiplier updated" : "Multiplier created" });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: MultiplierRow) => {
      const { error } = await (supabase as any)
        .from("pricing_multipliers")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-multipliers"] });
      qc.invalidateQueries({ queryKey: ["pricing-multipliers"] });
      qc.invalidateQueries({ queryKey: ["public-pricing-multipliers"] });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("pricing_multipliers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-multipliers"] });
      qc.invalidateQueries({ queryKey: ["pricing-multipliers"] });
      qc.invalidateQueries({ queryKey: ["public-pricing-multipliers"] });
      toast({ title: "Multiplier removed" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Pricing Multipliers</h2>
          <p className="text-xs text-muted-foreground">
            Advanced engine rules. Apply flat dollar adjustments or percentage modifiers
            based on conditions, square footage bands, add-ons, or any custom field.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Multiplier
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Multiplier" : "Add Multiplier"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select
                  value={form.service_type_id || "__global__"}
                  onValueChange={(v) =>
                    setForm({ ...form, service_type_id: v === "__global__" ? "" : v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global (all services)</SelectItem>
                    {(serviceTypes ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Axis</Label>
                  <Input
                    placeholder="condition, sqft_band, addon, …"
                    value={form.axis}
                    onChange={(e) => setForm({ ...form, axis: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Field key, or "condition" / "addon".
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Key</Label>
                  <Input
                    placeholder='Heavy, 1500-2500, "Window Cleaning"'
                    value={form.key}
                    onChange={(e) => setForm({ ...form, key: e.target.value })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Match value. Numeric ranges allowed (e.g. 1500-2500, 3000+).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Modifier Type</Label>
                  <Select
                    value={form.modifier_type}
                    onValueChange={(v) =>
                      setForm({ ...form, modifier_type: v as "flat_amount" | "percent" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat_amount">Flat amount ($)</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Display Label</Label>
                <Input
                  placeholder="e.g. Heavy Duty Cleaning Surcharge"
                  value={form.display_label}
                  onChange={(e) => setForm({ ...form, display_label: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Shown on quotes/invoices when this rule applies.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: !!v })}
                />
                <Label className="cursor-pointer">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Axis</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (rows ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">
                  No multipliers yet.
                </TableCell>
              </TableRow>
            )}
            {(rows ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.service_type_id ? (
                    <span className="text-sm">{serviceName(row.service_type_id)}</span>
                  ) : (
                    <Badge variant="secondary">Global</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{row.axis}</TableCell>
                <TableCell className="text-sm font-mono">{row.key}</TableCell>
                <TableCell className="text-sm">
                  {row.modifier_type === "percent" ? "Percent" : "Flat"}
                </TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {row.modifier_type === "percent"
                    ? `${Number(row.value).toFixed(2)}%`
                    : `$${Number(row.value).toFixed(2)}`}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                  {row.display_label || "—"}
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={row.is_active !== false}
                    onCheckedChange={() => toggleActive.mutate(row)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete this multiplier? This cannot be undone.")) {
                          removeMutation.mutate(row.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PricingMultipliersSettings;
