import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Star, CheckCircle2, Save } from "lucide-react";

const GoogleReviewsSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "sync" | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*");
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((r) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const enabled = settings?.google_reviews_enabled === "true";
  const placeName = settings?.google_place_name || "";
  const placeId = settings?.google_place_id || "";
  const rating = settings?.google_rating || "";
  const ratingCount = settings?.google_rating_count || "";
  const syncedAt = settings?.google_reviews_synced_at || "";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-settings"] });
    qc.invalidateQueries({ queryKey: ["site-settings"] });
    qc.invalidateQueries({ queryKey: ["google-reviews"] });
  };

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("google-reviews-sync", { body });
    if (error) {
      const details = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
      let message = details || error.message;
      try {
        const parsed = JSON.parse(details);
        if (parsed?.error) message = parsed.error;
      } catch {
        /* keep raw text */
      }
      throw new Error(message);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const handleSave = async () => {
    setBusy("save");
    setProblem(null);
    try {
      const data = await call({ action: "save", input });
      setInput("");
      refresh();
      toast({
        title: "Listing connected",
        description: `${data.place_name || "Your listing"} — ${data.synced} review(s) pulled in.`,
      });
    } catch (e: any) {
      setProblem(e.message);
      toast({ title: "Could not connect that listing", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    setProblem(null);
    try {
      const data = await call({ action: "sync" });
      refresh();
      toast({ title: "Reviews refreshed", description: `${data.synced} review(s) up to date.` });
    } catch (e: any) {
      setProblem(e.message);
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (on: boolean) => {
    const { error } = await supabase
      .from("site_settings")
      .upsert({ setting_key: "google_reviews_enabled", setting_value: on ? "true" : "false" }, { onConflict: "setting_key" });
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
    toast({ title: on ? "Google reviews are showing on the site" : "Google reviews hidden from the site" });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="font-display font-semibold text-foreground">Your Google listing</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Paste the link to your listing on Google Maps, or your Place ID (it starts with "ChI"). Saving
            pulls your star rating, total number of ratings, and the latest reviews straight from Google.
          </p>
        </div>

        {placeId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-foreground">{placeName || "Connected listing"}</p>
              <p className="text-xs text-muted-foreground">
                {rating ? `${rating} stars` : "No rating yet"}
                {ratingCount ? ` · ${ratingCount} ratings on Google` : ""}
                {syncedAt ? ` · Last updated ${new Date(syncedAt).toLocaleString()}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={busy !== null}>
              <RefreshCw className={`w-4 h-4 mr-2 ${busy === "sync" ? "animate-spin" : ""}`} /> Refresh now
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No listing connected yet.</p>
        )}

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://maps.app.goo.gl/… or ChIJ…"
            onKeyDown={(e) => e.key === "Enter" && input.trim() && handleSave()}
          />
          <Button onClick={handleSave} disabled={!input.trim() || busy !== null}>
            <Save className="w-4 h-4 mr-2" /> Save &amp; pull reviews
          </Button>
        </div>

        {problem && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm text-foreground">{problem}</p>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6 flex items-center justify-between gap-4">
        <div>
          <Label className="text-sm font-medium">Show Google reviews on the website</Label>
          <p className="text-xs text-muted-foreground mt-1">
            When off, only reviews left directly on your site are shown.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} disabled={!placeId} />
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5" /> Google only shares a handful of reviews at a time, so your own customer reviews
        still appear alongside them.
      </p>
    </div>
  );
};

export default GoogleReviewsSettings;
