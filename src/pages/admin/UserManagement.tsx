import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Users } from "lucide-react";
import { getRoleLabel, type AppRole } from "@/lib/permissions";

const UserManagement = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("staff");

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      if (!email || !password) throw new Error("Email and password required");
      if (password.length < 8) throw new Error("Password must be at least 8 characters");

      // Sign up the user via edge function or direct auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Failed to create user");

      // Assign role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: signUpData.user.id,
        role: role as any,
      });
      if (roleError) throw roleError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User created successfully" });
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setRole("staff");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role updated" });
    },
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "User removed" });
    },
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createUser.mutate(); }} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Password</label>
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

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !users?.length ? (
        <p className="text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground font-mono">{u.user_id}</p>
                <p className="text-xs text-muted-foreground">{getRoleLabel(u.role as AppRole)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={u.role} onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Super Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => removeUser.mutate(u.user_id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
