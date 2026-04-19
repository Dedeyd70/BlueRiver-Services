import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const settingsDef = [
  {
    key: "auto_approve_bookings",
    label: "Auto-Approve Bookings",
    type: "select" as const,
    options: [
      { value: "true", label: "On — new bookings start as Confirmed" },
      { value: "false", label: "Off — new bookings start as Pending" },
    ],
  },
  { key: "tax_rate", label: "Tax Rate (%) for Invoices", type: "input" as const, placeholder: "e.g. 10.25" },
];

const BusinessRulesSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const promises = settingsDef.map(({ key }) =>
        supabase.from("site_settings").upsert({ setting_key: key, setting_value: form[key] || "" }, { onConflict: "setting_key" })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Business rules saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save All
        </Button>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
        {settingsDef.map((s) => (
          <div key={s.key}>
            <label className="text-sm font-medium text-foreground mb-1.5 block">{s.label}</label>
            {s.type === "select" ? (
              <Select value={form[s.key] || s.options[0]?.value} onValueChange={(v) => setForm({ ...form, [s.key]: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {s.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={form[s.key] || ""}
                onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                placeholder={s.placeholder}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessRulesSettings;
