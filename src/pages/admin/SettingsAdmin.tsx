import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const settingsDef = [
  { key: "phone", label: "Business Phone", type: "input", placeholder: "(206) 317-8300" },
  { key: "phone_link", label: "Phone Link (tel format)", type: "input", placeholder: "+12063178300" },
  { key: "email", label: "Business Email", type: "input" },
  { key: "service_area", label: "Service Area", type: "input", placeholder: "Serving Washington State" },
  { key: "call_availability", label: "Call Availability Hours", type: "input", placeholder: "7:00 AM – 5:00 PM" },
  { key: "business_hours_mf", label: "Business Hours (Mon–Fri)", type: "input", placeholder: "Monday – Friday: 7:00 AM – 7:00 PM" },
  { key: "business_hours_sat", label: "Business Hours (Saturday)", type: "input", placeholder: "Saturday: 8:00 AM – 5:00 PM" },
  { key: "business_hours_sun", label: "Business Hours (Sunday)", type: "input", placeholder: "Sunday: Closed" },
  { key: "footer_tagline", label: "Footer Tagline", type: "textarea" },
  { key: "hero_headline", label: "Hero Headline", type: "input" },
  { key: "hero_subheadline", label: "Hero Subheadline", type: "textarea" },
  { key: "about_mission_title", label: "About - Mission Title", type: "input" },
  { key: "about_mission_p1", label: "About - Mission Paragraph 1", type: "textarea" },
  { key: "about_mission_p2", label: "About - Mission Paragraph 2", type: "textarea" },
];

const SettingsAdmin = () => {
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
      toast({ title: "Settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Site Settings</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save All
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
        {settingsDef.map((s) => (
          <div key={s.key}>
            <label className="text-sm font-medium text-foreground mb-1.5 block">{s.label}</label>
            {s.type === "textarea" ? (
              <Textarea
                value={form[s.key] || ""}
                onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                rows={3}
                placeholder={s.placeholder}
              />
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

export default SettingsAdmin;
