import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { BUNDLES, BundleKey, isBundleEnabled, applyBundle, PermissionsMap } from "@/lib/permissionBundles";
import { Loader2 } from "lucide-react";

interface TeamUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  permissions: PermissionsMap;
}

const TeamManagementSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["team-management-users"],
    queryFn: async (): Promise<TeamUser[]> => {
      const res = await supabase.functions.invoke("list-admin-users");
      if (res.error) {
        // Fall back to user_roles only — still functional for permission editing.
        const { data, error: rErr } = await supabase.from("user_roles").select("*");
        if (rErr) throw rErr;
        return (data ?? []).map((r: any) => ({
          user_id: r.user_id,
          email: null,
          full_name: null,
          role: r.role,
          permissions: r.permissions ?? {},
        }));
      }
      return (res.data?.users ?? []) as TeamUser[];
    },
    retry: 1,
  });

  const toggleBundle = useMutation({
    mutationFn: async (args: { userId: string; bundle: BundleKey; enabled: boolean; current: PermissionsMap }) => {
      setSavingId(args.userId);
      const next = applyBundle(args.current ?? {}, args.bundle, args.enabled);
      const { error } = await supabase
        .from("user_roles")
        .update({ permissions: next as any })
        .eq("user_id", args.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-management-users"] });
      toast({ title: "Permissions updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
    onSettled: () => setSavingId(null),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading team…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive p-4 border border-destructive/30 rounded-lg bg-destructive/5">
        Failed to load team. {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Team Management</h2>
        <p className="text-sm text-muted-foreground">
          Toggle functional permission bundles for each team member. Super Admin always has full access.
        </p>
      </div>

      <div className="space-y-3">
        {(users ?? []).map((u) => (
          <Card key={u.user_id} className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="font-medium text-foreground">{u.full_name || u.email || u.user_id}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
                <Badge variant="secondary" className="mt-2 capitalize">{u.role}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-w-[280px]">
                {(Object.keys(BUNDLES) as BundleKey[]).map((key) => {
                  const enabled = u.role === "admin" ? true : isBundleEnabled(u.permissions ?? {}, key);
                  const disabled = u.role === "admin" || (savingId === u.user_id);
                  return (
                    <label
                      key={key}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <Switch
                        checked={enabled}
                        disabled={disabled}
                        onCheckedChange={(v) =>
                          toggleBundle.mutate({
                            userId: u.user_id,
                            bundle: key,
                            enabled: v,
                            current: u.permissions ?? {},
                          })
                        }
                      />
                      <div className="text-sm">
                        <div className="font-medium text-foreground">{BUNDLES[key].label}</div>
                        <div className="text-xs text-muted-foreground">{BUNDLES[key].description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
        {users?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No team members found.</p>
        )}
      </div>
    </div>
  );
};

export default TeamManagementSettings;
