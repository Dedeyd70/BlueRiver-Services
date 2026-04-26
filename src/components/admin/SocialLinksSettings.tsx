import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, GripVertical } from "lucide-react";
import { getSocialIcon, getMatchedPlatformLabel } from "@/lib/socialIcons";
import type { SocialLink } from "@/hooks/useSocialLinks";

const SocialLinksSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialLink | null>(null);
  const [platform, setPlatform] = useState("");
  const [url, setUrl] = useState("");
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const { data: links, isLoading } = useQuery({
    queryKey: ["social-links", "all"],
    queryFn: async (): Promise<SocialLink[]> => {
      const { data, error } = await supabase
        .from("social_links" as any)
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SocialLink[];
    },
  });

  useEffect(() => {
    if (editing) {
      setPlatform(editing.platform_name);
      setUrl(editing.url);
      setOrder(editing.display_order);
      setIsActive(editing.is_active);
    } else {
      setPlatform("");
      setUrl("");
      setOrder(links?.length ?? 0);
      setIsActive(true);
    }
  }, [editing, links?.length]);

  const upsert = useMutation({
    mutationFn: async () => {
      if (!platform.trim() || !url.trim()) throw new Error("Platform and URL are required");
      const payload = {
        platform_name: platform.trim(),
        url: url.trim(),
        display_order: order,
        is_active: isActive,
      };
      if (editing) {
        const { data, error } = await supabase
          .from("social_links" as any)
          .update(payload)
          .eq("id", editing.id)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Update blocked by permissions or RLS");
      } else {
        const { error } = await supabase.from("social_links" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-links"] });
      toast({ title: editing ? "Link updated" : "Link added" });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_links" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-links"] });
      toast({ title: "Link removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Live icon preview
  const PreviewIcon = getSocialIcon(platform);
  const matchedLabel = getMatchedPlatformLabel(platform);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Social Media Links</h2>
          <p className="text-xs text-muted-foreground">Add, edit, or remove links displayed in the site footer.</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Link
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : !links?.length ? (
        <p className="text-muted-foreground text-sm">No social links yet. Add one to get started.</p>
      ) : (
        <div className="space-y-2">
          {links.map((l) => {
            const Icon = getSocialIcon(l.platform_name);
            return (
              <div key={l.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                <Icon className="w-5 h-5 text-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{l.platform_name}</p>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary truncate block">
                    {l.url}
                  </a>
                </div>
                {!l.is_active && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">Hidden</span>
                )}
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => { setEditing(l); setDialogOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => remove.mutate(l.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Social Link" : "Add Social Link"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Platform Name *</label>
              <div className="flex items-center gap-2">
                <Input
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  placeholder="e.g. Facebook, TikTok, Threads"
                  required
                  className="flex-1"
                />
                <div className="w-10 h-10 flex items-center justify-center border border-border rounded-md bg-muted/30 shrink-0">
                  <PreviewIcon className="w-5 h-5 text-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {platform.trim() === ""
                  ? "Type a platform to see icon match"
                  : matchedLabel
                  ? <>Matched: <span className="text-foreground font-medium">{matchedLabel}</span></>
                  : "No match — using generic Link icon"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">URL *</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." required type="url" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Display Order</label>
                <Input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Active</label>
                <div className="flex items-center h-10">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "Saving..." : editing ? "Save Changes" : "Add Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialLinksSettings;
