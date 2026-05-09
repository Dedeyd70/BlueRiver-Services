import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";

// ZIP column is intentionally hidden from the admin UI (soft-delete). It still
// exists in the database (NOT NULL) so existing data is preserved and the
// feature can be re-enabled later with no migration. New rows insert "".
type Area = { id: string; zip?: string; city: string; is_active: boolean };

const ServiceAreasSettings = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [city, setCity] = useState("Bellevue");

  const { data } = useQuery({
    queryKey: ["admin-service-areas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("service_areas")
        .select("*")
        .order("city");
      if (error) throw error;
      return (data ?? []) as Area[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-service-areas"] });
    qc.invalidateQueries({ queryKey: ["service-areas", true] });
    qc.invalidateQueries({ queryKey: ["service-areas", false] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const c = city.trim();
      if (!c) throw new Error("City is required");
      const { error } = await (supabase as any)
        .from("service_areas")
        // `zip` retained as empty string to satisfy NOT NULL; field is hidden.
        .insert({ zip: "", city: c, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      setCity("Bellevue");
      invalidate();
      toast({ title: "Service area added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async (a: Area) => {
      const { error } = await (supabase as any)
        .from("service_areas")
        .update({ is_active: !a.is_active })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("service_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Removed" });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Add Service Area</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bellevue" className="w-64" />
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {(data ?? []).map((a) => (
          <Card key={a.id} className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{a.city}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={a.is_active} onCheckedChange={() => toggle.mutate(a)} />
                <Label className="text-xs">Active</Label>
              </div>
              <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Remove ${a.city}?`)) remove.mutate(a.id); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
        {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No service areas yet.</p>}
      </div>
    </div>
  );
};

export default ServiceAreasSettings;
