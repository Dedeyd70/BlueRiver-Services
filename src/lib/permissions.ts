// Role-based permission configuration
// admin = Super Admin, manager = Manager, staff = Staff

export type AppRole = "admin" | "manager" | "staff" | "user";

interface NavPermission {
  label: string;
  path: string;
  roles: AppRole[]; // which roles can see this nav item
}

export const NAV_PERMISSIONS: NavPermission[] = [
  { label: "Dashboard", path: "/admin", roles: ["admin", "manager"] },
  { label: "Bookings", path: "/admin/bookings", roles: ["admin", "manager", "staff"] },
  { label: "Quotes", path: "/admin/quotes", roles: ["admin", "manager", "staff"] },
  { label: "Submissions", path: "/admin/submissions", roles: ["admin", "manager", "staff"] },
  { label: "Services", path: "/admin/services", roles: ["admin", "manager"] },
  { label: "Gallery", path: "/admin/gallery", roles: ["admin", "manager"] },
  { label: "Before & After", path: "/admin/before-after", roles: ["admin", "manager"] },
  { label: "Testimonials", path: "/admin/testimonials", roles: ["admin", "manager"] },
  { label: "Availability", path: "/admin/availability", roles: ["admin", "manager"] },
  { label: "Payment", path: "/admin/payment", roles: ["admin", "manager"] },
  { label: "Privacy Policy", path: "/admin/privacy-policy", roles: ["admin"] },
  { label: "Terms of Service", path: "/admin/terms", roles: ["admin"] },
  { label: "Legal Pages", path: "/admin/legal", roles: ["admin"] },
  { label: "Homepage Images", path: "/admin/homepage-images", roles: ["admin"] },
  { label: "Branding", path: "/admin/branding", roles: ["admin"] },
  { label: "Settings", path: "/admin/settings", roles: ["admin"] },
  { label: "Users", path: "/admin/users", roles: ["admin"] },
  { label: "Account", path: "/admin/account", roles: ["admin", "manager", "staff"] },
];

export const canAccessPath = (role: AppRole, path: string): boolean => {
  const permission = NAV_PERMISSIONS.find((p) => p.path === path);
  if (!permission) return role === "admin"; // unknown paths: admin only
  return permission.roles.includes(role);
};

export const getFilteredNavItems = (role: AppRole) => {
  return NAV_PERMISSIONS.filter((p) => p.roles.includes(role));
};

export const getRoleLabel = (role: AppRole): string => {
  switch (role) {
    case "admin": return "Super Admin";
    case "manager": return "Manager";
    case "staff": return "Staff";
    default: return "User";
  }
};
