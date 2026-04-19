import { useState } from "react";
import { Lock, Eye, EyeOff, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const SessionLockOverlay = () => {
  const { user, unlock, signOut } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    const { error } = await unlock(password);
    setLoading(false);
    if (error) {
      toast({ title: "Unlock failed", description: error, variant: "destructive" });
      setPassword("");
    } else {
      setPassword("");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] backdrop-blur-md bg-background/80 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-foreground" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">Session Locked</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as <span className="font-medium text-foreground">{user?.email}</span>
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Unlocking..." : "Unlock"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SessionLockOverlay;
