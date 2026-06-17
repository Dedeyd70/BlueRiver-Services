import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplets, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AdminSetup = () => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const verifyToken = async () => {
      // 1. Get the parameters after the '?' in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");
      const type = urlParams.get("type");

      // 2. Fallback check: Did we arrive via a successful redirection session?
      const { data: { session } } = await supabase.auth.getSession();

      // 3. If any of these are true, keep the setup screen open!
      if (session || (token && type === "invite")) {
        setIsValidToken(true);
      } else {
        toast({
          title: "Access Denied",
          description: "Invalid or expired invitation token.",
          variant: "destructive",
        });
        navigate("/admin/login", { replace: true });
      }
    };

    verifyToken();
  }, [navigate, toast]);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save the client's chosen password to their verified profile record
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (error) {
      toast({ 
        title: "Account setup failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Account activated!", 
        description: "Your master admin password has been set up successfully." 
      });
      
      // Right to the secret dashboard!
      navigate("/onpass-useradmin-blueriveracess052026", { replace: true });
    }
  };

  if (!isValidToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-hero-gradient flex items-center justify-center mx-auto mb-4">
            <Droplets className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Setup Admin Account
          </h1>
          <p className="text-sm text-muted-foreground mt-1">BlueRiver Services Workspace</p>
        </div>

        <form onSubmit={handleSetupSubmit} className="space-y-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="bg-muted p-3 rounded-lg text-xs text-muted-foreground mb-2">
            Your email address has been securely verified via your workspace token. Please set your password below.
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Create Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            <UserPlus className="w-4 h-4 mr-2" />
            {loading ? "Activating..." : "Complete Account Setup"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminSetup;