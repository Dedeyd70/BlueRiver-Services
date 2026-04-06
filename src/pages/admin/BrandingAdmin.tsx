import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";

const BrandingAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a73e8");
  const [secondaryColor, setSecondaryColor] = useState("#0097a7");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-branding"],
    queryFn: async () => {
      const { data } = await supabase.from("branding_settings").select("*");
      const map: Record<string, string> = {};
      data?.forEach((r: any) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  useEffect(() => {
    if (settings) {
      setLogoUrl(settings.logo_url || "");
      setPrimaryColor(settings.primary_color || "#1a73e8");
      setSecondaryColor(settings.secondary_color || "#0097a7");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const entries = [
        { setting_key: "logo_url", setting_value: logoUrl },
        { setting_key: "primary_color", setting_value: primaryColor },
        { setting_key: "secondary_color", setting_value: secondaryColor },
      ];
      for (const entry of entries) {
        await supabase.from("branding_settings").upsert(entry, { onConflict: "setting_key" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
      toast({ title: "Branding settings saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">Branding</h1>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Logo</label>
          <p className="text-xs text-muted-foreground mb-2">Upload a custom logo. If empty, the default logo will be used.</p>
          <ImageUpload value={logoUrl} onChange={setLogoUrl} folder="branding" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#1a73e8" className="flex-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
              <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#0097a7" className="flex-1" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <p className="text-sm font-medium text-foreground mb-2">Preview</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>
              Primary
            </div>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: secondaryColor }}>
              Secondary
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingAdmin;
