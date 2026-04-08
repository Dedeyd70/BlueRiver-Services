import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Save, Palette, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUpload from "@/components/ImageUpload";

const fontOptions = [
  "Inter", "Poppins", "Roboto", "Open Sans", "Lato", "Montserrat",
  "Raleway", "Nunito", "Source Sans Pro", "PT Sans", "Work Sans",
];

const defaultValues = {
  logo_url: "",
  favicon_url: "",
  logo_size: "medium",
  primary_color: "#1a73e8",
  secondary_color: "#0097a7",
  accent_color: "#f59e0b",
  background_color: "#ffffff",
  font_family: "Inter",
};

const BrandingAdmin = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState(defaultValues);

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
      setForm({
        logo_url: settings.logo_url || "",
        favicon_url: settings.favicon_url || "",
        logo_size: settings.logo_size || "medium",
        primary_color: settings.primary_color || "#1a73e8",
        secondary_color: settings.secondary_color || "#0097a7",
        accent_color: settings.accent_color || "#f59e0b",
        background_color: settings.background_color || "#ffffff",
        font_family: settings.font_family || "Inter",
      });
    }
  }, [settings]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(form).map(([k, v]) => ({ setting_key: k, setting_value: v }));
      for (const entry of entries) {
        await supabase.from("branding_settings").upsert(entry, { onConflict: "setting_key" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
      qc.invalidateQueries({ queryKey: ["public-branding"] });
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setForm(defaultValues)}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Logo & Identity */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
          <h2 className="text-lg font-display font-semibold text-foreground">Logo & Identity</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Logo</label>
              <p className="text-xs text-muted-foreground mb-2">PNG, JPG, or SVG. If empty, default logo is used.</p>
              <ImageUpload value={form.logo_url} onChange={(v) => update("logo_url", v)} folder="branding" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Favicon</label>
              <p className="text-xs text-muted-foreground mb-2">Small icon shown in browser tab.</p>
              <ImageUpload value={form.favicon_url} onChange={(v) => update("favicon_url", v)} folder="branding" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Logo Size</label>
            <Select value={form.logo_size} onValueChange={(v) => update("logo_size", v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Colours */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
          <h2 className="text-lg font-display font-semibold text-foreground">Colours</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { key: "primary_color", label: "Primary Colour" },
              { key: "secondary_color", label: "Secondary Colour" },
              { key: "accent_color", label: "Accent Colour" },
              { key: "background_color", label: "Background Colour" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={(form as any)[key]}
                    onChange={(e) => update(key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                  />
                  <Input
                    value={(form as any)[key]}
                    onChange={(e) => update(key, e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold text-foreground">Typography</h2>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Font Family</label>
            <Select value={form.font_family} onValueChange={(v) => update("font_family", v)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fontOptions.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-display font-semibold text-foreground">Live Preview</h2>
          <div className="rounded-xl border border-border overflow-hidden" style={{ backgroundColor: form.background_color, fontFamily: form.font_family }}>
            {/* Preview navbar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ backgroundColor: form.primary_color }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="h-8 w-auto object-contain brightness-0 invert" />
              ) : (
                <span className="text-white font-bold text-sm">BlueRiver</span>
              )}
              <span className="text-white/70 text-xs ml-auto">Preview Navbar</span>
            </div>
            {/* Preview body */}
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-bold" style={{ color: form.primary_color }}>Sample Heading</h3>
              <p className="text-sm text-muted-foreground">This is how body text will look with the selected font and colors.</p>
              <div className="flex gap-3">
                <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: form.primary_color }}>
                  Primary Button
                </button>
                <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: form.secondary_color }}>
                  Secondary
                </button>
                <button className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: form.accent_color }}>
                  Accent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingAdmin;
