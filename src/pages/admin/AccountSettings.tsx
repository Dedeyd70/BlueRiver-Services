import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Mail, Shield } from "lucide-react";

const AccountSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Email update
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Password update
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Confirmation sent", description: "Check both old and new email to confirm the change." });
      setNewEmail("");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated successfully" });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Account Security</h1>
      </div>

      <div className="space-y-6">
        {/* Current info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-2">Current Account</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {/* Update Email */}
        <form onSubmit={handleUpdateEmail} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Change Email</h2>
          </div>
          <p className="text-xs text-muted-foreground">A confirmation will be sent to both old and new email addresses.</p>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email address"
            required
          />
          <Button type="submit" size="sm" disabled={emailLoading}>
            {emailLoading ? "Sending..." : "Update Email"}
          </Button>
        </form>

        {/* Update Password */}
        <form onSubmit={handleUpdatePassword} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
          </div>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            required
            minLength={8}
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            minLength={8}
          />
          <Button type="submit" size="sm" disabled={passwordLoading}>
            {passwordLoading ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AccountSettings;
