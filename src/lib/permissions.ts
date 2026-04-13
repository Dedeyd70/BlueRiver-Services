// Role-based permission configuration
// admin = Super Admin, manager = Manager, staff = Staff

export type AppRole = "admin" | "manager" | "staff" | "user";

interface NavPermission {
  label: string;
  path: string;
  roles: AppRole[];
  group: string;
}

export const NAV_GROUPS = [
  { key: "main", label: "" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance" },
  { key: "website", label: "Website" },
  { key: "system", label: "System" },
];

export const NAV_PERMISSIONS: NavPermission[] = [
  // Main
  { label: "Dashboard", path: "/admin", roles: ["admin", "manager"], group: "main" },

  // Operations
  { label: "Bookings", path: "/admin/bookings", roles: ["admin", "manager", "staff"], group: "operations" },
  { label: "Quotes", path: "/admin/quotes", roles: ["admin", "manager", "staff"], group: "operations" },
  { label: "Submissions", path: "/admin/submissions", roles: ["admin", "manager", "staff"], group: "operations" },

  // Finance
  { label: "Invoices", path: "/admin/invoices", roles: ["admin", "manager"], group: "finance" },

  // Website
  { label: "Services", path: "/admin/services", roles: ["admin", "manager"], group: "website" },
  { label: "Gallery", path: "/admin/gallery", roles: ["admin", "manager"], group: "website" },
  { label: "Testimonials", path: "/admin/testimonials", roles: ["admin", "manager"], group: "website" },
  { label: "Homepage Images", path: "/admin/homepage-images", roles: ["admin"], group: "website" },
  { label: "Branding", path: "/admin/branding", roles: ["admin"], group: "website" },
  { label: "Privacy Policy", path: "/admin/privacy-policy", roles: ["admin"], group: "website" },
  { label: "Terms of Service", path: "/admin/terms", roles: ["admin"], group: "website" },
  { label: "Legal Pages", path: "/admin/legal", roles: ["admin"], group: "website" },

  // System
  { label: "Settings", path: "/admin/settings", roles: ["admin"], group: "system" },
  { label: "Users", path: "/admin/users", roles: ["admin"], group: "system" },
  { label: "Account", path: "/admin/account", roles: ["admin", "manager", "staff"], group: "system" },
];

export const canAccessPath = (role: AppRole, path: string): boolean => {
  const permission = NAV_PERMISSIONS.find((p) => p.path === path);
  if (!permission) return role === "admin";
  return permission.roles.includes(role);
};

export const getFilteredNavItems = (role: AppRole) => {
  return NAV_PERMISSIONS.filter((p) => p.roles.includes(role));
};

export const getGroupedNavItems = (role: AppRole) => {
  const items = getFilteredNavItems(role);
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: items.filter((i) => i.group === g.key),
  })).filter((g) => g.items.length > 0);
};

export const getRoleLabel = (role: AppRole): string => {
  switch (role) {
    case "admin": return "Super Admin";
    case "manager": return "Manager";
    case "staff": return "Staff";
    default: return "User";
  }
};
