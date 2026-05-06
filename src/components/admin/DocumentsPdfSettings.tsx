import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_HEX = "#1E3A8A";

// Editable site_settings keys this tab manages.
const EDITABLE_KEYS = [
  "brand_color_hex",
  "phone",
  "email",
  "company_address",
  "invoice_footer_note",
  "invoice_terms",
] as const;

type FormState = Record<(typeof EDITABLE_KEYS)[number], string>;

const emptyForm: FormState = {
  brand_color_hex: "",
  phone: "",
  email: "",
  company_address: "",
  invoice_footer_note: "",
  invoice_terms: "",
};

const DocumentsPdfSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: site } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: branding } = useQuery({
    queryKey: ["admin-branding"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branding_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  useEffect(() => {
    if (site) {
      setForm({
        brand_color_hex: site.brand_color_hex || "",
        phone: site.phone || "",
        email: site.email || "",
        company_address: site.company_address || "",
        invoice_footer_note: site.invoice_footer_note || "",
        invoice_terms: site.invoice_terms || "",
      });
    }
  }, [site]);

  const update = (key: keyof FormState, value: string, max = 300) =>
    setForm((f) => ({ ...f, [key]: value.slice(0, max) }));

  const save = useMutation({
    mutationFn: async () => {
      if (form.brand_color_hex && !HEX_RE.test(form.brand_color_hex)) {
        throw new Error("Brand color must be a 6-digit hex like #1E3A8A.");
      }
      const rows = EDITABLE_KEYS.map((key) => ({
        setting_key: key,
        setting_value: form[key] ?? "",
      }));
      // Parameterized via the SDK — no string concatenation.
      const { error } = await supabase
        .from("site_settings")
        .upsert(rows, { onConflict: "setting_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-branding"] });
      qc.invalidateQueries({ queryKey: ["public-branding"] });
      toast({ title: "Document settings saved" });
    },
    onError: (e: Error) =>
      toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const previewColor = HEX_RE.test(form.brand_color_hex) ? form.brand_color_hex : DEFAULT_HEX;
  const businessName = branding?.business_name || "BlueRiver Services LLC";
  const logoUrl = branding?.logo_url || "";
  const tagline = site?.footer_tagline || "Professional cleaning services";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Documents & PDF</h2>
          <p className="text-sm text-muted-foreground">
            Controls the letterhead, brand color, and footer used on every invoice, quote, and receipt PDF.
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
      </div>

      {/* Live preview */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">PDF letterhead preview</p>
        <div
          className="rounded-md overflow-hidden"
          style={{ background: "#0F172A" }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="w-10 h-10 rounded object-cover bg-white/10"
              />
            ) : (
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-white text-sm font-bold"
                style={{ background: previewColor }}
              >
                BR
              </div>
            )}
            <div className="min-w-0">
              <div className="text-white font-semibold text-sm truncate">{businessName}</div>
              <div className="text-slate-300 text-[11px] truncate">{tagline}</div>
              <div className="text-slate-300 text-[11px] truncate">
                {[form.phone, form.email, form.company_address].filter(Boolean).join("  ·  ")}
              </div>
            </div>
          </div>
          <div className="h-1" style={{ background: previewColor }} />
        </div>
      </div>

      {/* Read-only mirror */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Letterhead (managed in Branding)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Business name</div>
            <div className="text-foreground">{businessName}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Logo</div>
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-10 w-auto rounded border border-border" />
            ) : (
              <div className="text-muted-foreground text-xs">No logo set</div>
            )}
          </div>
        </div>
      </div>

      {/* Editable */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Brand color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={HEX_RE.test(form.brand_color_hex) ? form.brand_color_hex : DEFAULT_HEX}
              onChange={(e) => update("brand_color_hex", e.target.value, 7)}
              className="h-10 w-14 rounded border border-border bg-background cursor-pointer"
              aria-label="Brand color picker"
            />
            <Input
              value={form.brand_color_hex}
              onChange={(e) => update("brand_color_hex", e.target.value, 7)}
              placeholder="#1E3A8A"
              className="max-w-[160px] font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Used for header text, totals, and accent lines. Leave blank for the default navy.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Phone</label>
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value, 40)}
              placeholder="(206) 317-8300"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
            <Input
              value={form.email}
              onChange={(e) => update("email", e.target.value, 120)}
              placeholder="info@blueriverservices.co"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Phone and email are shared with the Business Info tab and the public site footer.
        </p>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Company mailing address
          </label>
          <Textarea
            value={form.company_address}
            onChange={(e) => update("company_address", e.target.value, 200)}
            placeholder="123 Main St, Bellevue, WA 98004"
            rows={2}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Required by CAN-SPAM. Shown in the PDF letterhead and the email footer.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Invoice / quote terms (optional)
          </label>
          <Input
            value={form.invoice_terms}
            onChange={(e) => update("invoice_terms", e.target.value, 200)}
            placeholder="Net 7 — please remit payment within 7 days of issue."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            Footer note (optional)
          </label>
          <Textarea
            value={form.invoice_footer_note}
            onChange={(e) => update("invoice_footer_note", e.target.value, 300)}
            placeholder="Thank you for choosing BlueRiver Services."
            rows={2}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Replaces the default thank-you line at the bottom of every invoice and quote.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentsPdfSettings;
