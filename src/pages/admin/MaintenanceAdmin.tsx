import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { HardDrive, Trash2, FileSearch, Loader2, AlertTriangle } from "lucide-react";

const BUCKET = "site-images";

type OrphanFile = { path: string; size: number };

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// Recursively list every object in the storage bucket.
async function listAllObjects(prefix = ""): Promise<OrphanFile[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;
  let files: OrphanFile[] = [];
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    // Folders are returned with a null id and no metadata.
    if ((item as any).id === null) {
      files = files.concat(await listAllObjects(path));
    } else if (item.name) {
      files.push({ path, size: (item as any).metadata?.size ?? 0 });
    }
  }
  return files;
}

// Pull the storage path out of any public URL that points at our bucket.
const pathFromUrl = (value?: string | null): string | null => {
  if (!value || typeof value !== "string") return null;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(value.slice(idx + marker.length).split("?")[0]);
  } catch {
    return value.slice(idx + marker.length).split("?")[0];
  }
};

type RetentionReport = {
  dry_run: boolean;
  days: number;
  notifications: number;
  booking_activity_logs: number;
  contact_activity_logs: number;
};

const MaintenanceAdmin = () => {
  const { toast } = useToast();

  // ---- Orphaned media sweep state ----
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orphans, setOrphans] = useState<OrphanFile[] | null>(null);

  // ---- Log retention state ----
  const [days, setDays] = useState(90);
  const [reporting, setReporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [report, setReport] = useState<RetentionReport | null>(null);

  const scanOrphans = async () => {
    setScanning(true);
    setOrphans(null);
    try {
      const [objects, gallery, homepage, branding] = await Promise.all([
        listAllObjects(),
        supabase.from("gallery").select("image_url"),
        supabase.from("homepage_images").select("image_url"),
        supabase.from("branding_settings").select("setting_value"),
      ]);

      const referenced = new Set<string>();
      (gallery.data ?? []).forEach((r: any) => {
        const p = pathFromUrl(r.image_url);
        if (p) referenced.add(p);
      });
      (homepage.data ?? []).forEach((r: any) => {
        const p = pathFromUrl(r.image_url);
        if (p) referenced.add(p);
      });
      (branding.data ?? []).forEach((r: any) => {
        const p = pathFromUrl(r.setting_value);
        if (p) referenced.add(p);
      });

      const found = objects.filter((o) => !referenced.has(o.path));
      setOrphans(found);
      toast({
        title: "Scan complete",
        description: `${found.length} unreferenced file(s) found out of ${objects.length} total.`,
      });
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const deleteOrphans = async () => {
    if (!orphans?.length) return;
    setDeleting(true);
    try {
      const { error } = await supabase.storage.from(BUCKET).remove(orphans.map((o) => o.path));
      if (error) throw error;
      toast({ title: "Deleted", description: `Removed ${orphans.length} orphaned file(s).` });
      setOrphans(null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const runRetention = async (dryRun: boolean) => {
    if (dryRun) setReporting(true);
    else setPurging(true);
    try {
      const { data, error } = await supabase.rpc("cleanup_old_records" as any, {
        p_days: days,
        p_dry_run: dryRun,
      });
      if (error) throw error;
      const r = data as unknown as RetentionReport;
      setReport(r);
      toast({
        title: dryRun ? "Report ready" : "Cleanup complete",
        description: dryRun
          ? "Review the counts below before deleting."
          : `Removed ${r.notifications + r.booking_activity_logs + r.contact_activity_logs} record(s).`,
      });
      if (!dryRun) setReport(null);
    } catch (e: any) {
      toast({ title: "Cleanup failed", description: e.message, variant: "destructive" });
    } finally {
      setReporting(false);
      setPurging(false);
    }
  };

  const orphanTotal = orphans?.reduce((sum, o) => sum + o.size, 0) ?? 0;

  return (
    <div className="pb-24 max-w-3xl">
      <h1 className="text-2xl font-display font-bold text-foreground mb-1">Maintenance</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Admin-only housekeeping tools. Each tool generates a report first — nothing is deleted until you confirm.
      </p>

      {/* Orphaned media sweep */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Orphaned Media Sweep</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Finds stored images that are no longer referenced by the gallery, homepage images, or branding settings.
        </p>

        <Button onClick={scanOrphans} disabled={scanning} variant="outline">
          {scanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
          {scanning ? "Scanning…" : "Scan for orphaned files"}
        </Button>

        {orphans && (
          <div className="mt-4">
            {orphans.length === 0 ? (
              <p className="text-sm text-green-700">No orphaned files found — storage is clean.</p>
            ) : (
              <>
                <p className="text-sm text-foreground mb-2">
                  <strong>{orphans.length}</strong> unreferenced file(s) — {formatBytes(orphanTotal)} reclaimable.
                </p>
                <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border mb-3">
                  {orphans.map((o) => (
                    <div key={o.path} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                      <span className="truncate text-muted-foreground">{o.path}</span>
                      <span className="shrink-0 text-muted-foreground">{formatBytes(o.size)}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={deleteOrphans} disabled={deleting} variant="destructive" size="sm">
                  {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete {orphans.length} file(s)
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Log & notification retention */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Log & Notification Retention</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Reports notifications and activity logs older than the chosen window. Nothing is removed until you confirm.
        </p>

        <div className="flex items-end gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Older than (days)</label>
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-32"
            />
          </div>
          <Button onClick={() => runRetention(true)} disabled={reporting} variant="outline">
            {reporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSearch className="w-4 h-4 mr-2" />}
            Generate report
          </Button>
        </div>

        {report && (
          <div className="border border-border rounded-lg p-4">
            <p className="text-sm text-foreground mb-2">
              Records older than <strong>{report.days}</strong> day(s):
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 mb-3">
              <li>Notifications: <strong className="text-foreground">{report.notifications}</strong></li>
              <li>Booking activity logs: <strong className="text-foreground">{report.booking_activity_logs}</strong></li>
              <li>Contact activity logs: <strong className="text-foreground">{report.contact_activity_logs}</strong></li>
            </ul>
            {report.notifications + report.booking_activity_logs + report.contact_activity_logs === 0 ? (
              <p className="text-sm text-green-700">Nothing to clean up in this window.</p>
            ) : (
              <div className="flex items-center gap-2 text-amber-700 text-xs mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This permanently deletes the records listed above.
              </div>
            )}
            {report.notifications + report.booking_activity_logs + report.contact_activity_logs > 0 && (
              <Button onClick={() => runRetention(false)} disabled={purging} variant="destructive" size="sm">
                {purging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Confirm delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceAdmin;
