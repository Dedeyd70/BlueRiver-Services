import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Users, ShieldAlert, ShieldCheck } from "lucide-react";
import { getRoleLabel, type AppRole } from "@/lib/permissions";
import { usePermissionRegistry } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

const UserManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: registry } = usePermissionRegistry();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [permsTarget, setPermsTarget] = useState<{ user_id: string; full_name?: string | null; email?: string | null; role: string; permissions?: Record<string, boolean> | null } | null>(null);
  const [permsState, setPermsState] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("staff");

  useEffect(() => {
    if (permsTarget) {
      const initial: Record<string, boolean> = {};
      (registry ?? []).forEach((p) => {
        initial[p.key] = permsTarget.permissions?.[p.key] === true;
      });
      setPermsState(initial);
    }
  }, [permsTarget, registry]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Try enriched endpoint first, fall back to basic user_roles
      const res = await supabase.functions.invoke("list-admin-users");
      if (!res.error && res.data?.users) return res.data.users;
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data.map((r: any) => ({ ...r, email: null, full_name: null }));
    },
  });

  const adminCount = users?.filter((u) => u.role === "admin").length ?? 0;

  const createUser = useMutation({
    mutationFn: async () => {
      if (!email || !password || !fullName) throw new Error("All fields are required");
      if (password.length < 8) throw new Error("Password must be at least 8 characters");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("create-admin-user", {
        body: { email, password, role, full_name: fullName },
      });

      if (res.error) throw new Error(res.error.message || "Failed to create user");
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User created successfully" });
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("staff");
    },
    onError: (e: Error) => toast({ title: "Unable to create user", description: e.message, variant: "destructive" }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      // Prevent demoting the last admin
      const currentUser = users?.find((u) => u.user_id === userId);
      if (currentUser?.role === "admin" && newRole !== "admin" && adminCount <= 1) {
        throw new Error("Cannot change the last Super Admin's role. At least one Super Admin must remain.");
      }
      const { data, error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      // Prevent deleting the last admin
      const targetUser = users?.find((u) => u.user_id === userId);
      if (targetUser?.role === "admin" && adminCount <= 1) {
        throw new Error("Cannot delete the last Super Admin. At least one Super Admin must remain.");
      }
      // Prevent self-deletion
      if (userId === user?.id) {
        throw new Error("You cannot delete your own account.");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("delete-admin-user", {
        body: { user_id: userId },
      });

      // Prefer specific message from edge function body, then context, then generic
      const dataErr = (res.data as { error?: string } | null)?.error;
      const ctxErr = (res.error as { context?: { error?: string } } | null)?.context?.error;
      const msgErr = res.error?.message;
      if (dataErr) throw new Error(dataErr);
      if (ctxErr) throw new Error(ctxErr);
      if (res.error) throw new Error(msgErr || "Failed to delete user");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User removed" });
      setDeleteConfirm(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const savePerms = useMutation({
    mutationFn: async () => {
      if (!permsTarget) return;
      const { data, error } = await supabase
        .from("user_roles")
        .update({ permissions: permsState as any })
        .eq("user_id", permsTarget.user_id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Update blocked by permissions or RLS");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Permissions updated" });
      setPermsTarget(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">User Management</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {adminCount <= 1 && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>There is only one Super Admin. This account cannot be deleted or demoted.</span>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name *</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Password *</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Super Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this user? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && removeUser.mutate(deleteConfirm)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !users?.length ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isLastAdmin = u.role === "admin" && adminCount <= 1;
            const isSelf = u.user_id === user?.id;
            return (
              <div key={u.id} className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {u.full_name || u.email || <span className="font-mono text-xs">{u.user_id}</span>}
                  </p>
                  {u.email && u.full_name && (
                    <p className="text-xs text-muted-foreground/70">{u.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {getRoleLabel(u.role as AppRole)}
                    {isSelf && <span className="ml-1 text-primary">(You)</span>}
                    {isLastAdmin && <span className="ml-1 text-amber-600">(Protected)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={u.role}
                    onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v })}
                    disabled={isLastAdmin}
                  >
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Super Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    title="Manage permissions"
                    onClick={() => setPermsTarget({
                      user_id: u.user_id,
                      full_name: u.full_name,
                      email: u.email,
                      role: u.role,
                      permissions: (u as any).permissions ?? {},
                    })}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8"
                    onClick={() => setDeleteConfirm(u.user_id)}
                    disabled={isLastAdmin || isSelf}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!permsTarget} onOpenChange={(o) => !o && setPermsTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissions for {permsTarget?.full_name || permsTarget?.email || "User"}</DialogTitle>
          </DialogHeader>
          {permsTarget?.role === "admin" ? (
            <p className="text-sm text-muted-foreground">Super Admins automatically have all permissions.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {!registry?.length ? (
                <p className="text-sm text-muted-foreground">No permissions defined yet. Add some on the Permissions page.</p>
              ) : (
                registry.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.label}</p>
                      <p className="text-xs font-mono text-muted-foreground">{p.key}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                    </div>
                    <Switch
                      checked={!!permsState[p.key]}
                      onCheckedChange={(v) => setPermsState((s) => ({ ...s, [p.key]: v }))}
                    />
                  </div>
                ))
              )}
            </div>
          )}
          {permsTarget?.role !== "admin" && !!registry?.length && (
            <DialogFooter>
              <Button onClick={() => savePerms.mutate()} disabled={savePerms.isPending}>
                {savePerms.isPending ? "Saving..." : "Save Permissions"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
