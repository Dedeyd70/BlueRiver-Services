import { useEffect, useState } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, MessageSquare, Wrench, FileText, Settings, Shield, LogOut, Image, DollarSign, Menu, ScrollText, CalendarDays, FileQuestion, Clock, Scale, Palette, Users, ImageIcon, Gavel, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/blueriver-logo.png";
import { getGroupedNavItems, canAccessPath, getRoleLabel, type AppRole } from "@/lib/permissions";
import NotificationBell from "@/components/admin/NotificationBell";

const iconMap: Record<string, any> = {
  Dashboard: LayoutDashboard,
  Bookings: CalendarDays,
  Quotes: FileQuestion,
  Submissions: MessageSquare,
  Services: Wrench,
  Gallery: Image,
  Testimonials: FileText,
  Invoices: Receipt,
  "Privacy Policy": ScrollText,
  "Terms of Service": Scale,
  "Legal Pages": Gavel,
  "Homepage Images": ImageIcon,
  Branding: Palette,
  Settings: Settings,
  Users: Users,
  Account: Shield,
};

const SidebarContent = ({ location, signOut, role, onNavClick }: { location: ReturnType<typeof useLocation>; signOut: () => void; role: AppRole; onNavClick?: () => void }) => {
  const groups = getGroupedNavItems(role);

  return (
    <>
      <div className="p-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2" onClick={onNavClick}>
          <img src={logo} alt="BlueRiver" className="h-8 w-auto object-contain" />
          <div>
            <span className="font-display font-bold text-foreground text-sm block">Admin</span>
            <span className="text-[10px] text-muted-foreground">{getRoleLabel(role)}</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.key}>
            {group.label && (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 mb-1">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = iconMap[item.label] || Settings;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavClick}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => { signOut(); onNavClick?.(); }}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </>
  );
};

const AdminLayout = () => {
  const { user, isAdmin, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin/login");
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (!loading && user && isAdmin && role) {
      if (!canAccessPath(role, location.pathname)) {
        navigate("/admin");
      }
    }
  }, [loading, user, isAdmin, role, location.pathname, navigate]);

  useEffect(() => setSheetOpen(false), [location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user || !isAdmin || !role) return null;

  return (
    <div className="min-h-screen flex bg-muted/50">
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col shrink-0">
        <SidebarContent location={location} signOut={signOut} role={role} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center gap-3 p-3 bg-card border-b border-border">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SidebarContent location={location} signOut={signOut} role={role} onNavClick={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 flex-1">
            <img src={logo} alt="BlueRiver" className="h-7 w-auto object-contain" />
            <span className="font-display font-bold text-foreground text-sm">Admin</span>
          </div>
          <NotificationBell />
        </header>

        {/* Desktop notification bell */}
        <div className="hidden md:flex items-center justify-end p-2 pr-4">
          <NotificationBell />
        </div>

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
