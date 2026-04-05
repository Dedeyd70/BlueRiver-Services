import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, MessageSquare, Wrench, FileText, Settings, Shield, LogOut, Image, DollarSign, Menu, ScrollText, CalendarDays, FileQuestion, Clock, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/blueriver-logo.png";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Bookings", path: "/admin/bookings", icon: CalendarDays },
  { label: "Quotes", path: "/admin/quotes", icon: FileQuestion },
  { label: "Submissions", path: "/admin/submissions", icon: MessageSquare },
  { label: "Services", path: "/admin/services", icon: Wrench },
  { label: "Gallery", path: "/admin/gallery", icon: Image },
  { label: "Testimonials", path: "/admin/testimonials", icon: FileText },
  { label: "Availability", path: "/admin/availability", icon: Clock },
  { label: "Payment", path: "/admin/payment", icon: DollarSign },
  { label: "Privacy Policy", path: "/admin/privacy-policy", icon: ScrollText },
  { label: "Terms of Service", path: "/admin/terms", icon: Scale },
  { label: "Settings", path: "/admin/settings", icon: Settings },
  { label: "Account", path: "/admin/account", icon: Shield },
];

const SidebarContent = ({ location, signOut, onNavClick }: { location: ReturnType<typeof useLocation>; signOut: () => void; onNavClick?: () => void }) => (
  <>
    <div className="p-4 border-b border-border">
      <Link to="/" className="flex items-center gap-2" onClick={onNavClick}>
        <img src={logo} alt="BlueRiver" className="h-8 w-auto object-contain" />
        <span className="font-display font-bold text-foreground text-sm">Admin</span>
      </Link>
    </div>
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
    <div className="p-3 border-t border-border">
      <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => { signOut(); onNavClick?.(); }}>
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  </>
);

const AdminLayout = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin/login");
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => setSheetOpen(false), [location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="min-h-screen flex bg-muted/50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col shrink-0">
        <SidebarContent location={location} signOut={signOut} />
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 p-3 bg-card border-b border-border">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SidebarContent location={location} signOut={signOut} onNavClick={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={logo} alt="BlueRiver" className="h-7 w-auto object-contain" />
            <span className="font-display font-bold text-foreground text-sm">Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
