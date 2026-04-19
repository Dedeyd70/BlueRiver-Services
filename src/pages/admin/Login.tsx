import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplets, LogIn, ArrowLeft, Eye, EyeOff, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getRoleLabel } from "@/lib/permissions";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const { user, isAdmin, role, isLocked, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error, variant: "destructive" });
    } else {
      navigate("/admin", { replace: true });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "A password reset link has been sent to your email." });
      setShowForgot(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
  };

  const showActiveSessionPanel = user && isAdmin && !isLocked && !showForgot;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-hero-gradient flex items-center justify-center mx-auto mb-4">
            <Droplets className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-1">BlueRiver Services Dashboard</p>
        </div>

        {showActiveSessionPanel ? (
          <div className="space-y-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div>
              <p className="text-sm text-muted-foreground">You are currently signed in as</p>
              <p className="text-base font-medium text-foreground mt-1">{user.email}</p>
              {role && (
                <p className="text-xs text-muted-foreground mt-0.5">{getRoleLabel(role)}</p>
              )}
            </div>
            <Button className="w-full" onClick={() => navigate("/admin")}>
              Continue to Dashboard
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSwitchAccount}>
              <LogOut className="w-4 h-4 mr-2" />
              Switch Account
            </Button>
          </div>
        ) : showForgot ? (
          <form onSubmit={handleResetPassword} className="space-y-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Back to login
            </button>
            <p className="text-sm text-muted-foreground">Enter your admin email to receive a password reset link.</p>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="admin@example.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={resetLoading}>
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required autoComplete="email" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
