import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const intInput = (v: string) => Math.max(0, Math.round(Number(v) || 0));
const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const PricingSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  const { data: serviceTypes } = useQuery({
    queryKey: ["admin-service-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("service_types").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fields } = useQuery({
    queryKey: ["admin-service-fields"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("service_fields").select("*").order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["admin-pricing-rules"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("service_pricing_rules").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: conditions } = useQuery({
    queryKey: ["admin-conditions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("condition_settings").select("*").order("surcharge_amount");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [stEdits, setStEdits] = useState<Record<string, number>>({});
  const [ruleEdits, setRuleEdits] = useState<Record<string, number>>({});
  const [condEdits, setCondEdits] = useState<Record<string, number>>({});

  useEffect(() => {
    if (serviceTypes) {
      const m: Record<string, number> = {};
      serviceTypes.forEach((s: any) => (m[s.id] = s.base_price));
      setStEdits(m);
      if (!selectedServiceId && serviceTypes.length > 0) {
        setSelectedServiceId(serviceTypes[0].id);
      }
    }
  }, [serviceTypes, selectedServiceId]);

  useEffect(() => {
    if (rules) {
      const m: Record<string, number> = {};
      rules.forEach((r: any) => (m[r.id] = r.unit_price));
      setRuleEdits(m);
    }
  }, [rules]);

  useEffect(() => {
    if (conditions) {
      const m: Record<string, number> = {};
      conditions.forEach((c: any) => (m[c.id] = c.surcharge_amount));
      setCondEdits(m);
    }
  }, [conditions]);

  // Auto-heal: ensure every number field has a matching pricing rule
  const healingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!fields || !rules || !selectedServiceId) return;
    const numberFieldsForService = fields.filter(
      (f: any) => f.service_type_id === selectedServiceId && f.input_type === "number",
    );
    const missing = numberFieldsForService.filter(
      (f: any) =>
        !rules.find((r: any) => r.service_type_id === selectedServiceId && r.category === f.field_key) &&
        !healingRef.current.has(`${selectedServiceId}:${f.field_key}`),
    );
    if (missing.length === 0) return;
    missing.forEach((f: any) => healingRef.current.add(`${selectedServiceId}:${f.field_key}`));
    (async () => {
      const inserts = missing.map((f: any) => ({
        service_type_id: selectedServiceId,
        category: f.field_key,
        unit_price: 0,
      }));
      const { error } = await (supabase as any).from("service_pricing_rules").insert(inserts);
      if (!error) qc.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
    })();
  }, [fields, rules, selectedServiceId, qc]);

  const saveBase = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(stEdits).map(([id, base_price]) =>
        (supabase as any)
          .from("service_types")
          .update({ base_price: intInput(String(base_price)) })
          .eq("id", id)
          .select("id")
          .maybeSingle(),
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
      const blocked = results.find((r: any) => !r.data);
      if (blocked) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-service-types"] });
      toast({ title: "Base prices saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveRules = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(ruleEdits).map(([id, unit_price]) =>
        (supabase as any)
          .from("service_pricing_rules")
          .update({ unit_price: intInput(String(unit_price)) })
          .eq("id", id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      toast({ title: "Pricing saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveConditions = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(condEdits).map(([id, amt]) =>
        (supabase as any)
          .from("condition_settings")
          .update({ surcharge_amount: intInput(String(amt)) })
          .eq("id", id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-conditions"] });
      toast({ title: "Condition surcharges saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addField = useMutation({
    mutationFn: async (payload: {
      service_type_id: string;
      field_key: string;
      label: string;
      input_type: string;
      required: boolean;
      options: string[];
    }) => {
      const { error: fErr } = await (supabase as any).from("service_fields").insert({
        service_type_id: payload.service_type_id,
        field_key: payload.field_key,
        label: payload.label,
        input_type: payload.input_type,
        required: payload.required,
        options: payload.options,
        display_order: 100,
      });
      if (fErr) throw fErr;
      if (payload.input_type === "number") {
        await (supabase as any)
          .from("service_pricing_rules")
          .insert({ service_type_id: payload.service_type_id, category: payload.field_key, unit_price: 0 });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-service-fields"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      toast({ title: "Field added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateField = useMutation({
    mutationFn: async (payload: {
      id: string;
      label: string;
      input_type: string;
      required: boolean;
      options: string[];
    }) => {
      const { error } = await (supabase as any)
        .from("service_fields")
        .update({
          label: payload.label,
          input_type: payload.input_type,
          required: payload.required,
          options: payload.options,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-service-fields"] });
      toast({ title: "Field updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteField = useMutation({
    mutationFn: async ({
      id,
      service_type_id,
      field_key,
    }: {
      id: string;
      service_type_id: string;
      field_key: string;
    }) => {
      await (supabase as any).from("service_fields").delete().eq("id", id);
      await (supabase as any)
        .from("service_pricing_rules")
        .delete()
        .eq("service_type_id", service_type_id)
        .eq("category", field_key);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-service-fields"] });
      qc.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      toast({ title: "Field removed" });
    },
  });

  const ruleFor = (service_type_id: string, field_key: string) =>
    (rules ?? []).find((r: any) => r.service_type_id === service_type_id && r.category === field_key);

  const selectedService = (serviceTypes ?? []).find((s: any) => s.id === selectedServiceId);
  const selectedFields = (fields ?? []).filter((f: any) => f.service_type_id === selectedServiceId);

  return (
    <div className="space-y-8">
      {/* Base prices */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Service Base Prices</h2>
          <Button size="sm" onClick={() => saveBase.mutate()} disabled={saveBase.isPending}>
            {saveBase.isPending ? "Saving..." : "Save Base Prices"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Integer dollars only. Used as the starting line item for every quote.
        </p>
        <div className="border border-border rounded-lg divide-y divide-border">
          {(serviceTypes ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-3 p-3">
              <span className="font-medium text-sm">{s.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={stEdits[s.id] ?? 0}
                  onChange={(e) => setStEdits({ ...stEdits, [s.id]: intInput(e.target.value) })}
                  className="w-28 h-9"
                />
              </div>
            </div>
          ))}
          {(serviceTypes ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground italic">
              No service types yet. Create a service in the Services page first.
            </p>
          )}
        </div>
      </section>

      {/* Dynamic fields + pricing per service */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg font-semibold">Service Fields & Pricing</h2>
          <Button size="sm" onClick={() => saveRules.mutate()} disabled={saveRules.isPending}>
            {saveRules.isPending ? "Saving..." : "Save Pricing"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Select a service to manage its fields and per-unit prices. Number fields carry a price; select/toggle fields
          control form UI only.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Select Service Type</label>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Choose a service…" />
            </SelectTrigger>
            <SelectContent>
              {(serviceTypes ?? []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedService ? (
          <ServiceFieldEditor
            service={selectedService}
            fields={selectedFields}
            ruleFor={ruleFor}
            ruleEdits={ruleEdits}
            setRuleEdits={setRuleEdits}
            onAddField={(payload) => addField.mutate({ service_type_id: selectedService.id, ...payload })}
            onUpdateField={(id, payload) => updateField.mutate({ id, ...payload })}
            onDeleteField={(id, field_key) =>
              deleteField.mutate({ id, service_type_id: selectedService.id, field_key })
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground italic p-4 border border-border rounded-lg">
            No service selected.
          </p>
        )}
      </section>

      {/* Conditions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Condition Surcharges</h2>
          <Button size="sm" onClick={() => saveConditions.mutate()} disabled={saveConditions.isPending}>
            {saveConditions.isPending ? "Saving..." : "Save Surcharges"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fixed integer surcharge per condition level. Applied after subtotal — separate from field pricing.
        </p>
        <div className="border border-border rounded-lg divide-y divide-border">
          {(conditions ?? []).map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3">
              <span className="font-medium text-sm">{c.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={condEdits[c.id] ?? 0}
                  onChange={(e) => setCondEdits({ ...condEdits, [c.id]: intInput(e.target.value) })}
                  className="w-28 h-9"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

interface FieldDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initial?: { label: string; input_type: string; required: boolean; options: string[]; field_key?: string };
  onSubmit: (p: { label: string; input_type: string; required: boolean; options: string[] }) => void;
  showKeyHint?: boolean;
}

const FieldDialog = ({ open, onOpenChange, title, initial, onSubmit, showKeyHint }: FieldDialogProps) => {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [inputType, setInputType] = useState(initial?.input_type ?? "number");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join("\n"));

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? "");
      setInputType(initial?.input_type ?? "number");
      setRequired(initial?.required ?? false);
      setOptionsText((initial?.options ?? []).join("\n"));
    }
  }, [open, initial]);

  const submit = () => {
    if (!label.trim()) return;
    const options =
      inputType === "select"
        ? optionsText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    onSubmit({ label: label.trim(), input_type: inputType, required, options });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Label</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Office Rooms" />
            {showKeyHint && label && (
              <p className="text-xs text-muted-foreground mt-1">
                Key: <code>{slugify(label) || "—"}</code>
              </p>
            )}
            {!showKeyHint && initial?.field_key && (
              <p className="text-xs text-muted-foreground mt-1">
                Key: <code>{initial.field_key}</code> (immutable)
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Input type</label>
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="number">Number (priced)</option>
              <option value="select">Select</option>
              <option value="toggle">Toggle</option>
            </select>
          </div>
          {inputType === "select" && (
            <div>
              <label className="text-sm font-medium mb-1 block">Options (one per line)</label>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} />
            <span className="text-sm">Required</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!label.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface FieldEditorProps {
  service: any;
  fields: any[];
  ruleFor: (sid: string, key: string) => any;
  ruleEdits: Record<string, number>;
  setRuleEdits: (m: Record<string, number>) => void;
  onAddField: (p: {
    field_key: string;
    label: string;
    input_type: string;
    required: boolean;
    options: string[];
  }) => void;
  onUpdateField: (id: string, p: { label: string; input_type: string; required: boolean; options: string[] }) => void;
  onDeleteField: (id: string, field_key: string) => void;
}

const ServiceFieldEditor = ({
  service,
  fields,
  ruleFor,
  ruleEdits,
  setRuleEdits,
  onAddField,
  onUpdateField,
  onDeleteField,
}: FieldEditorProps) => {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-sm">{service.name}</div>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Field
        </Button>
      </div>

      <FieldDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={`Add field to ${service.name}`}
        showKeyHint
        onSubmit={(p) => {
          const field_key = slugify(p.label);
          if (!field_key) return;
          onAddField({ field_key, ...p });
        }}
      />

      <FieldDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={`Edit field`}
        initial={
          editing
            ? {
                label: editing.label,
                input_type: editing.input_type,
                required: editing.required,
                options: Array.isArray(editing.options) ? editing.options : [],
                field_key: editing.field_key,
              }
            : undefined
        }
        onSubmit={(p) => {
          if (editing) onUpdateField(editing.id, p);
          setEditing(null);
        }}
      />

      {fields.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-muted-foreground">No fields configured for this service yet.</p>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add your first field
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {fields.map((f: any) => {
            const rule = ruleFor(service.id, f.field_key);
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.field_key} · {f.input_type}
                    {f.required ? " · required" : ""}
                  </div>
                </div>
                {f.input_type === "number" && rule ? (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">$</span>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      value={ruleEdits[rule.id] ?? 0}
                      onChange={(e) => setRuleEdits({ ...ruleEdits, [rule.id]: intInput(e.target.value) })}
                      className="w-24 h-8"
                    />
                  </div>
                ) : f.input_type === "number" ? (
                  <Badge variant="outline" className="text-xs">
                    syncing…
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    not priced
                  </Badge>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(f)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onDeleteField(f.id, f.field_key)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PricingSettings;
