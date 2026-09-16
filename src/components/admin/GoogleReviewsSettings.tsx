import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Star, CheckCircle2 } from "lucide-react";

type Candidate = { id: string; name: string; address: string; rating: number | null; rating_count: number | null };

const GoogleReviewsSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [notListed, setNotListed] = useState<string | null>(null);
  const [busy, setBusy] = useState<"lookup" | "sync" | null>(null);

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
      throw new Error(details || error.message);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const handleLookup = async () => {
    setBusy("lookup");
    setNotListed(null);
    try {
      const data = await call({ action: "lookup", query });
      setCandidates(data.candidates ?? []);
      if (!data.candidates?.length) {
        setNotListed(data.searched_for || query);
        toast({
          title: "Not found on Google",
          description: "Google's public business search doesn't return this listing yet.",
        });
      }
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleSelect = async (id: string) => {
    setBusy("sync");
    try {
      const data = await call({ action: "sync", place_id: id });
      setCandidates(null);
      setQuery("");
      refresh();
      toast({ title: "Connected", description: `${data.place_name} — ${data.synced} review(s) pulled in.` });
    } catch (e: any) {
      toast({ title: "Could not connect that listing", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async () => {
    setBusy("sync");
    try {
      const data = await call({ action: "sync" });
      refresh();
      toast({ title: "Reviews refreshed", description: `${data.synced} review(s) up to date.` });
    } catch (e: any) {
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
            Search for your business, or paste any link to your listing on Google Maps — the short
            "maps.app.goo.gl" kind works too.
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Business name and city, or a Google Maps link"
            onKeyDown={(e) => e.key === "Enter" && query.trim() && handleLookup()}
          />
          <Button onClick={handleLookup} disabled={!query.trim() || busy !== null}>
            <Search className="w-4 h-4 mr-2" /> Search
          </Button>
        </div>

        {notListed && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
            <p className="text-sm font-medium text-foreground">
              Google's business search doesn't return "{notListed}" yet
            </p>
            <p className="text-xs text-muted-foreground">
              This usually means the business profile isn't verified or published yet. Once you verify it
              with Google Business Profile, search it again here and the reviews will start coming in. Until
              then, your website keeps showing the reviews customers leave on your own site.
            </p>
          </div>
        )}

        {candidates && candidates.length > 0 && (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.address}
                    {c.rating ? ` · ${c.rating} stars (${c.rating_count ?? 0})` : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => handleSelect(c.id)} disabled={busy !== null}>
                  This is us
                </Button>
              </div>
            ))}
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
