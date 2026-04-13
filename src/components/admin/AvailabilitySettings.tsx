import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const AvailabilitySettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [weekdayStart, setWeekdayStart] = useState("07:00");
  const [weekdayEnd, setWeekdayEnd] = useState("19:00");
  const [satStart, setSatStart] = useState("08:00");
  const [satEnd, setSatEnd] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["admin-availability"],
    queryFn: async () => {
      const { data } = await supabase.from("availability_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((r: any) => (map[r.setting_key] = r.setting_value));
      return map;
    },
  });

  const { data: blockedDates, refetch: refetchBlocked } = useQuery({
    queryKey: ["admin-blocked-dates"],
    queryFn: async () => {
      const { data } = await supabase.from("blocked_dates").select("*").order("blocked_date");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (settings) {
      if (settings.working_days?.days) setWorkingDays(settings.working_days.days);
      if (settings.working_hours) { setWeekdayStart(settings.working_hours.start); setWeekdayEnd(settings.working_hours.end); }
      if (settings.saturday_hours) { setSatStart(settings.saturday_hours.start); setSatEnd(settings.saturday_hours.end); }
      if (settings.time_slot_duration?.minutes) setSlotMinutes(settings.time_slot_duration.minutes);
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      const upserts = [
        { setting_key: "working_days", setting_value: { days: workingDays } },
        { setting_key: "working_hours", setting_value: { start: weekdayStart, end: weekdayEnd } },
        { setting_key: "saturday_hours", setting_value: { start: satStart, end: satEnd } },
        { setting_key: "time_slot_duration", setting_value: { minutes: slotMinutes } },
      ];
      for (const u of upserts) {
        const { error } = await supabase.from("availability_settings").upsert(u, { onConflict: "setting_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-availability"] });
      qc.invalidateQueries({ queryKey: ["availability-settings"] });
      toast({ title: "Availability saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addBlockedDate = useMutation({
    mutationFn: async () => {
      if (!newBlockDate) return;
      const { error } = await supabase.from("blocked_dates").insert({ blocked_date: newBlockDate, reason: newBlockReason || null });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchBlocked();
      setNewBlockDate("");
      setNewBlockReason("");
      toast({ title: "Date blocked" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeBlockedDate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchBlocked();
      toast({ title: "Date unblocked" });
    },
  });

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" /> Save Settings
        </Button>
      </div>
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="font-display font-semibold text-foreground mb-4">Working Days</h2>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((name, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={workingDays.includes(i)} onCheckedChange={() => toggleDay(i)} />
                <span className="text-sm">{name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="font-display font-semibold text-foreground mb-4">Working Hours</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Weekdays (Mon-Fri)</h3>
              <div className="flex items-center gap-2">
                <Input type="time" value={weekdayStart} onChange={(e) => setWeekdayStart(e.target.value)} className="w-32" />
                <span className="text-muted-foreground">to</span>
                <Input type="time" value={weekdayEnd} onChange={(e) => setWeekdayEnd(e.target.value)} className="w-32" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Saturday</h3>
              <div className="flex items-center gap-2">
                <Input type="time" value={satStart} onChange={(e) => setSatStart(e.target.value)} className="w-32" />
                <span className="text-muted-foreground">to</span>
                <Input type="time" value={satEnd} onChange={(e) => setSatEnd(e.target.value)} className="w-32" />
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="font-display font-semibold text-foreground mb-4">Time Slot Duration</h2>
          <div className="flex items-center gap-2">
            <Input type="number" value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className="w-24" min={15} max={240} step={15} />
            <span className="text-sm text-muted-foreground">minutes per slot</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="font-display font-semibold text-foreground mb-4">Blocked Dates</h2>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
              <Input type="date" value={newBlockDate} onChange={(e) => setNewBlockDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Reason (optional)</label>
              <Input value={newBlockReason} onChange={(e) => setNewBlockReason(e.target.value)} placeholder="Holiday, etc." className="w-48" />
            </div>
            <Button onClick={() => addBlockedDate.mutate()} disabled={!newBlockDate} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Block Date
            </Button>
          </div>
          {(blockedDates ?? []).length > 0 && (
            <div className="space-y-2">
              {blockedDates!.map((bd: any) => (
                <div key={bd.id} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-sm font-medium text-foreground">{format(new Date(bd.blocked_date + "T00:00:00"), "MMMM d, yyyy")}</span>
                    {bd.reason && <span className="text-sm text-muted-foreground ml-2">— {bd.reason}</span>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeBlockedDate.mutate(bd.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailabilitySettings;
