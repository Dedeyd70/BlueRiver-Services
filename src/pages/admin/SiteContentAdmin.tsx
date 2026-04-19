import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const settingsDef = [
  { key: "hero_headline", label: "Hero Headline", type: "input" as const },
  { key: "hero_subheadline", label: "Hero Subheadline", type: "textarea" as const },
  { key: "about_mission_title", label: "About — Mission Title", type: "input" as const },
  { key: "about_mission_p1", label: "About — Mission Paragraph 1", type: "textarea" as const },
  { key: "about_mission_p2", label: "About — Mission Paragraph 2", type: "textarea" as const },
  { key: "stats_clients", label: "Stats — Happy Clients", type: "input" as const, placeholder: "1,000+" },
  { key: "stats_years", label: "Stats — Years Experience", type: "input" as const, placeholder: "5+" },
  { key: "stats_satisfaction", label: "Stats — Satisfaction Rate", type: "input" as const, placeholder: "98%" },
  { key: "stats_rating", label: "Stats — Rating", type: "input" as const, placeholder: "4.9" },
  { key: "footer_tagline", label: "Footer Tagline", type: "textarea" as const },
];

const SiteContentAdmin = () => {
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
      toast({ title: "Site content saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Site Content</h1>
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

export default SiteContentAdmin;
