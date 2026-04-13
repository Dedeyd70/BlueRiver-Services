import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const paymentKeys = [
  { key: "payment_methods", label: "Accepted Payment Methods", type: "input", placeholder: "Cash, Zelle" },
  { key: "payment_policy", label: "Payment Policy", type: "textarea", placeholder: "Payment is typically made after service completion." },
  { key: "deposit_info", label: "Deposit Requirements", type: "textarea", placeholder: "A deposit may be required for large or specialized jobs." },
  { key: "zelle_info", label: "Zelle Information", type: "input", placeholder: "Send to: email@example.com or phone number" },
];

const PaymentSettings = () => {
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
      const promises = paymentKeys.map(({ key }) =>
        supabase.from("site_settings").upsert(
          { setting_key: key, setting_value: form[key] || "" },
          { onConflict: "setting_key" }
        )
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "Payment settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        {paymentKeys.map((s) => (
          <div key={s.key}>
            <label className="text-sm font-medium text-foreground mb-1.5 block">{s.label}</label>
            {s.type === "textarea" ? (
              <Textarea value={form[s.key] || ""} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} rows={3} placeholder={s.placeholder} />
            ) : (
              <Input value={form[s.key] || ""} onChange={(e) => setForm({ ...form, [s.key]: e.target.value })} placeholder={s.placeholder} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentSettings;
