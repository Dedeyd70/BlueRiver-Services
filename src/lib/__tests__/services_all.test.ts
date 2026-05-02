import { describe, it, expect } from "vitest";
import {
  computeQuote,
  type ServiceType,
  type PricingRule,
  type ServiceField,
  type PricingMultiplier,
} from "../pricingEngine";

// Mirrors the seeded service_types (names & approximate base prices used in production)
const SERVICES: ServiceType[] = [
  { id: "svc-residential", name: "Residential Cleaning", base_price: 120 },
  { id: "svc-deep", name: "Deep Cleaning", base_price: 200 },
  { id: "svc-move", name: "Move-in / Move-out Cleaning", base_price: 250 },
  { id: "svc-office", name: "Commercial Cleaning", base_price: 180 },
  { id: "svc-recurring", name: "Recurring Cleaning", base_price: 90 },
];

const FIELDS: ServiceField[] = SERVICES.flatMap((s) => [
  { id: `${s.id}-bd`, service_type_id: s.id, field_key: "bedrooms", label: "Bedrooms", display_order: 1 },
  { id: `${s.id}-ba`, service_type_id: s.id, field_key: "full_bathrooms", label: "Full Bathrooms", display_order: 2 },
]);

const RULES: PricingRule[] = SERVICES.flatMap((s) => [
  { id: `${s.id}-r-bd`, service_type_id: s.id, category: "bedrooms", unit_price: 25 },
  { id: `${s.id}-r-ba`, service_type_id: s.id, category: "full_bathrooms", unit_price: 30 },
]);

describe("Service archetypes — every service produces a positive subtotal", () => {
  it.each(SERVICES)("$name calculates subtotal > 0", (svc) => {
    const r = computeQuote(
      { service_type_id: svc.id, bedrooms: 2, full_bathrooms: 1 },
      SERVICES,
      RULES,
      [],
      0,
      FIELDS,
      []
    );
    expect(r.subtotal).toBeGreaterThan(0);
    // Base must always be present
    expect(r.lineItems.find((i) => i.type === "base")?.total_price).toBe(svc.base_price);
  });
});

describe("Recurring Cleaning — base $90 + frequency discount", () => {
  it("pulls $90 base when no extras applied", () => {
    const r = computeQuote(
      { service_type_id: "svc-recurring" },
      SERVICES,
      RULES,
      [],
      0,
      [],
      []
    );
    expect(r.subtotal).toBe(90);
  });

  it("applies a weekly frequency discount as a percent multiplier", () => {
    // -20% weekly discount stored as a multiplier on the frequency axis.
    const multipliers: PricingMultiplier[] = [
      {
        id: "freq-weekly",
        service_type_id: "svc-recurring",
        axis: "frequency",
        key: "weekly",
        modifier_type: "percent",
        value: -20,
        display_label: "Weekly recurring discount (-20%)",
        is_active: true,
      },
    ];
    const r = computeQuote(
      { service_type_id: "svc-recurring", custom_fields: { frequency: "weekly" } },
      SERVICES,
      RULES,
      [],
      0,
      [],
      multipliers
    );
    // 90 base + (-18) discount = 72
    expect(r.subtotal).toBe(72);
    expect(r.lineItems.find((i) => i.type === "condition")?.total_price).toBe(-18);
  });

  it("applies a flat monthly frequency discount", () => {
    const multipliers: PricingMultiplier[] = [
      {
        id: "freq-monthly",
        service_type_id: "svc-recurring",
        axis: "frequency",
        key: "monthly",
        modifier_type: "flat_amount",
        value: -10,
        display_label: "Monthly discount",
        is_active: true,
      },
    ];
    const r = computeQuote(
      { service_type_id: "svc-recurring", custom_fields: { frequency: "monthly" } },
      SERVICES,
      RULES,
      [],
      0,
      [],
      multipliers
    );
    expect(r.subtotal).toBe(80);
  });
});
