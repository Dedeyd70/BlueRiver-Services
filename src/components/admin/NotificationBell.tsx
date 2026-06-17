import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

const referenceRoutes: Record<string, string> = {
  booking: "/onpass-useradmin-blueriveracess052026/bookings",
  quote: "/onpass-useradmin-blueriveracess052026/quotes",
  contact: "/onpass-useradmin-blueriveracess052026/messages",
  invoice: "/onpass-useradmin-blueriveracess052026/invoices",
  cleaner_application: "/onpass-useradmin-blueriveracess052026/cleaner-applications",
};

const NotificationBell = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifications } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message, is_read, reference_type, reference_id, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });

  // Realtime subscription replaces the previous 30s polling firehose.
  useEffect(() => {
    const channel = supabase
      .channel(`admin-notifications-bell-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => qc.invalidateQueries({ queryKey: ["admin-notifications"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const unreadCount = notifications?.filter((n: any) => !n.is_read).length ?? 0;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications?.filter((n: any) => !n.is_read) ?? [];
      if (!unread.length) return;
      const ids = unread.map((n: any) => n.id);
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", ids)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) markRead.mutate(n.id);
    const route = referenceRoutes[n.reference_type];
    if (route) {
      setOpen(false);
      const url = n.reference_id ? `${route}?focus=${n.reference_id}` : route;
      navigate(url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!notifications?.length ? (
            <p className="text-sm text-muted-foreground p-4 text-center">No notifications</p>
          ) : (
            notifications.map((n: any) => (
              <div
                key={n.id}
                className={`flex items-start gap-2 p-3 border-b border-border last:border-0 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${
                  !n.is_read ? "bg-primary/5" : ""
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-foreground ${!n.is_read ? "font-medium" : ""}`}>{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && <Check className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
