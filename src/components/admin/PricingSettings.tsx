import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const ROOM_CATEGORIES = ["Bedroom", "Bathroom", "FullBath", "HalfBath", "Kitchen", "LivingRoom", "OfficeRoom"];

const intInput = (v: string) => Math.max(0, Math.round(Number(v) || 0));

const PricingSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: serviceTypes } = useQuery({
    queryKey: ["admin-service-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("service_types").select("*").order("name");
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
    }
  }, [serviceTypes]);

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

  const saveBase = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(stEdits).map(([id, base_price]) =>
        (supabase as any).from("service_types").update({ base_price: intInput(String(base_price)) }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
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
        (supabase as any).from("service_pricing_rules").update({ unit_price: intInput(String(unit_price)) }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r: any) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pricing-rules"] });
      toast({ title: "Category rules saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveConditions = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(condEdits).map(([id, amt]) =>
        (supabase as any).from("condition_settings").update({ surcharge_amount: intInput(String(amt)) }).eq("id", id)
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

  const ensureRule = useMutation({
    mutationFn: async ({ service_type_id, category }: { service_type_id: string; category: string }) => {
      const { error } = await (supabase as any)
        .from("service_pricing_rules")
        .insert({ service_type_id, category, unit_price: 0 });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing-rules"] }),
  });

  const rulesByService: Record<string, Record<string, any>> = {};
  (rules ?? []).forEach((r: any) => {
    rulesByService[r.service_type_id] = rulesByService[r.service_type_id] || {};
    rulesByService[r.service_type_id][r.category] = r;
  });

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
        <p className="text-xs text-muted-foreground">Integer dollars only. Used as the starting line item for every quote.</p>
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
            <p className="p-4 text-sm text-muted-foreground italic">No service types yet.</p>
          )}
        </div>
      </section>

      {/* Category rules */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Category Pricing Rules</h2>
          <Button size="sm" onClick={() => saveRules.mutate()} disabled={saveRules.isPending}>
            {saveRules.isPending ? "Saving..." : "Save Rules"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Per-room rates per service. Integer dollars only.</p>
        <div className="space-y-4">
          {(serviceTypes ?? []).map((s: any) => (
            <div key={s.id} className="border border-border rounded-lg p-3">
              <div className="font-medium text-sm mb-2">{s.name}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ROOM_CATEGORIES.map((cat) => {
                  const rule = rulesByService[s.id]?.[cat];
                  if (!rule) {
                    return (
                      <Button
                        key={cat}
                        size="sm"
                        variant="outline"
                        onClick={() => ensureRule.mutate({ service_type_id: s.id, category: cat })}
                        className="justify-between"
                      >
                        + {cat}
                      </Button>
                    );
                  }
                  return (
                    <div key={cat} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-2 py-1.5">
                      <span className="text-sm">{cat}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-xs">$</span>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          value={ruleEdits[rule.id] ?? 0}
                          onChange={(e) => setRuleEdits({ ...ruleEdits, [rule.id]: intInput(e.target.value) })}
                          className="w-20 h-8"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Conditions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Condition Surcharges</h2>
          <Button size="sm" onClick={() => saveConditions.mutate()} disabled={saveConditions.isPending}>
            {saveConditions.isPending ? "Saving..." : "Save Surcharges"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Fixed integer surcharge per condition level.</p>
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

export default PricingSettings;
