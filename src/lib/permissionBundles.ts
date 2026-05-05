// Functional permission bundles. Each bundle expands into the granular
// permission keys that the rest of the app already consumes.

export type BundleKey = "operations" | "finance" | "content" | "system_admin";

export const BUNDLES: Record<BundleKey, { label: string; description: string; keys: string[] }> = {
  operations: {
    label: "Operations",
    description: "Bookings, Quotes, Messages, Availability",
    keys: ["can_manage_bookings", "can_manage_quotes", "can_manage_messages", "can_edit_availability"],
  },
  finance: {
    label: "Finance",
    description: "Invoices, Payments, Pricing",
    keys: ["can_manage_invoices", "can_manage_payment", "can_edit_pricing"],
  },
  content: {
    label: "Content",
    description: "FAQs, Reviews, Gallery, Site Content, Service Areas",
    keys: [
      "can_manage_settings",
      "can_manage_gallery",
      "can_manage_testimonials",
      "can_manage_site_content",
      "can_manage_legal",
    ],
  },
  system_admin: {
    label: "System Admin",
    description: "Business Rules, Socials + everything in Operations, Finance, Content",
    keys: [
      "can_manage_business_rules",
      "can_manage_socials",
      // expanded below
    ],
  },
};

// Expand system_admin to include all other bundles.
BUNDLES.system_admin.keys = Array.from(
  new Set([
    ...BUNDLES.system_admin.keys,
    ...BUNDLES.operations.keys,
    ...BUNDLES.finance.keys,
    ...BUNDLES.content.keys,
  ]),
);

export type PermissionsMap = Record<string, boolean>;

/** Returns true if every granular key for the bundle is enabled. */
export const isBundleEnabled = (perms: PermissionsMap, bundle: BundleKey): boolean =>
  BUNDLES[bundle].keys.every((k) => perms?.[k] === true);

/** Returns a new permissions map with the bundle toggled on or off. */
export const applyBundle = (
  perms: PermissionsMap,
  bundle: BundleKey,
  enabled: boolean,
): PermissionsMap => {
  const next: PermissionsMap = { ...(perms ?? {}) };
  for (const key of BUNDLES[bundle].keys) {
    next[key] = enabled;
  }
  return next;
};
