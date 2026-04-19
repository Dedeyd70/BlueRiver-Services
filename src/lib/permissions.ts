// Role-based + permission-aware navigation configuration
// admin = Super Admin, manager = Manager, staff = Staff

export type AppRole = "admin" | "manager" | "staff" | "user";
export type PermissionsMap = Record<string, boolean>;

interface NavPermission {
  label: string;
  path: string;
  roles: AppRole[];
  group: string;
  /** Optional permission key. When set, an explicit `false` in the user's
   *  permissions JSONB hides the item even if their role would normally allow it.
   *  Admin always bypasses this check. */
  permission?: string;
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
  { label: "Bookings", path: "/admin/bookings", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_bookings" },
  { label: "Quotes", path: "/admin/quotes", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_quotes" },
  { label: "Messages", path: "/admin/messages", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_messages" },
  { label: "Submissions", path: "/admin/submissions", roles: ["admin", "manager", "staff"], group: "operations", permission: "can_manage_messages" },

  // Finance
  { label: "Invoices", path: "/admin/invoices", roles: ["admin", "manager"], group: "finance" },

  // Website
  { label: "Services", path: "/admin/services", roles: ["admin", "manager"], group: "website" },
  { label: "Gallery", path: "/admin/gallery", roles: ["admin", "manager"], group: "website", permission: "can_manage_gallery" },
  { label: "Testimonials", path: "/admin/testimonials", roles: ["admin", "manager"], group: "website", permission: "can_manage_testimonials" },
  { label: "Homepage Images", path: "/admin/homepage-images", roles: ["admin"], group: "website" },
  { label: "Branding", path: "/admin/branding", roles: ["admin"], group: "website" },
  { label: "Privacy Policy", path: "/admin/privacy-policy", roles: ["admin"], group: "website" },
  { label: "Terms of Service", path: "/admin/terms", roles: ["admin"], group: "website" },
  { label: "Legal Pages", path: "/admin/legal", roles: ["admin"], group: "website" },

  // System
  { label: "Settings", path: "/admin/settings", roles: ["admin"], group: "system", permission: "can_manage_settings" },
  { label: "Users", path: "/admin/users", roles: ["admin"], group: "system" },
  { label: "Permissions", path: "/admin/permissions", roles: ["admin"], group: "system" },
  { label: "Account", path: "/admin/account", roles: ["admin", "manager", "staff"], group: "system" },
];

/** Visibility precedence:
 *  1. admin → always allowed
 *  2. item has a `permission` key → that key is authoritative (explicit false hides)
 *  3. otherwise → role-based fallback
 */
const isVisible = (item: NavPermission, role: AppRole, permissions: PermissionsMap): boolean => {
  if (role === "admin") return true;
  if (item.permission) return permissions?.[item.permission] === true;
  return item.roles.includes(role);
};

export const canAccessPath = (role: AppRole, path: string, permissions: PermissionsMap = {}): boolean => {
  const item = NAV_PERMISSIONS.find((p) => p.path === path);
  if (!item) return role === "admin";
  return isVisible(item, role, permissions);
};

export const getFilteredNavItems = (role: AppRole, permissions: PermissionsMap = {}) => {
  return NAV_PERMISSIONS.filter((item) => isVisible(item, role, permissions));
};

export const getGroupedNavItems = (role: AppRole, permissions: PermissionsMap = {}) => {
  const items = getFilteredNavItems(role, permissions);
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
