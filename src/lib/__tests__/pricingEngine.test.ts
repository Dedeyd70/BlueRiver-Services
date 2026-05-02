import { describe, it, expect } from "vitest";
import {
  computeQuote,
  type ServiceType,
  type PricingRule,
  type ServiceField,
  type PricingMultiplier,
  type ConditionSetting,
} from "../pricingEngine";

const SERVICE_ID = "svc-1";

const services: ServiceType[] = [
  { id: SERVICE_ID, name: "Standard Cleaning", base_price: 100 },
];

const fields: ServiceField[] = [
  { id: "f1", service_type_id: SERVICE_ID, field_key: "bedrooms", label: "Bedrooms", display_order: 1 },
  { id: "f2", service_type_id: SERVICE_ID, field_key: "full_bathrooms", label: "Full Bathrooms", display_order: 2 },
];

const rules: PricingRule[] = [
  { id: "r1", service_type_id: SERVICE_ID, category: "bedrooms", unit_price: 25 },
  { id: "r2", service_type_id: SERVICE_ID, category: "full_bathrooms", unit_price: 30 },
];

describe("computeQuote — base + dynamic fields", () => {
  it("calculates base price + bedrooms + bathrooms correctly", () => {
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 3, full_bathrooms: 2 },
      services,
      rules,
      [],
      0,
      fields,
      []
    );
    // 100 + (3*25) + (2*30) = 100 + 75 + 60 = 235
    expect(result.subtotal).toBe(235);
    expect(result.total).toBe(235);
    expect(result.lineItems.find((i) => i.type === "base")?.total_price).toBe(100);
  });

  it("omits zero-quantity fields", () => {
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 0, full_bathrooms: 1 },
      services,
      rules,
      [],
      0,
      fields,
      []
    );
    expect(result.subtotal).toBe(130);
    expect(result.lineItems.some((i) => i.name === "Bedrooms")).toBe(false);
  });
});

describe("computeQuote — pricing multipliers", () => {
  it("applies flat_amount multiplier as a line item", () => {
    const multipliers: PricingMultiplier[] = [
      {
        id: "m1",
        service_type_id: null,
        axis: "condition",
        key: "Heavy",
        modifier_type: "flat_amount",
        value: 50,
        display_label: "Heavy condition surcharge",
        is_active: true,
      },
    ];
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 2, condition_level: "Heavy" },
      services,
      rules,
      [],
      0,
      fields,
      multipliers
    );
    // base 100 + bedrooms 50 + flat 50 = 200
    expect(result.subtotal).toBe(200);
    expect(result.lineItems.find((i) => i.type === "condition")?.total_price).toBe(50);
  });

  it("applies percent multiplier on running subtotal (compounds after flat)", () => {
    const multipliers: PricingMultiplier[] = [
      {
        id: "m1", service_type_id: null, axis: "condition", key: "heavy",
        modifier_type: "flat_amount", value: 50, display_label: "Heavy flat", is_active: true,
      },
      {
        id: "m2", service_type_id: null, axis: "condition", key: "heavy",
        modifier_type: "percent", value: 10, display_label: "Heavy 10%", is_active: true,
      },
    ];
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 2, condition_level: "Heavy" },
      services,
      rules,
      [],
      0,
      fields,
      multipliers
    );
    // base 100 + bedrooms 50 = 150 → +flat 50 = 200 → +10% (20) = 220
    expect(result.subtotal).toBe(220);
  });

  it("ignores inactive multipliers", () => {
    const multipliers: PricingMultiplier[] = [
      {
        id: "m1", service_type_id: null, axis: "condition", key: "Heavy",
        modifier_type: "flat_amount", value: 999, display_label: "x", is_active: false,
      },
    ];
    const result = computeQuote(
      { service_type_id: SERVICE_ID, condition_level: "Heavy" },
      services, rules, [], 0, fields, multipliers
    );
    expect(result.subtotal).toBe(100);
  });
});

describe("computeQuote — legacy condition deduplication", () => {
  it("ignores legacy condition_settings even when 'Heavy' passed (no multiplier present)", () => {
    const legacyConditions: ConditionSetting[] = [
      { id: "c1", name: "Heavy", surcharge_amount: 75 },
    ];
    const result = computeQuote(
      { service_type_id: SERVICE_ID, condition_level: "Heavy" },
      services,
      rules,
      legacyConditions,
      0,
      fields,
      [] // no multipliers
    );
    // Only base 100 should remain — legacy surcharge MUST be ignored
    expect(result.subtotal).toBe(100);
    expect(result.lineItems.some((i) => i.type === "condition")).toBe(false);
  });

  it("only the multiplier applies when both legacy and multiplier exist (no double-charge)", () => {
    const legacyConditions: ConditionSetting[] = [
      { id: "c1", name: "Heavy", surcharge_amount: 75 },
    ];
    const multipliers: PricingMultiplier[] = [
      {
        id: "m1", service_type_id: null, axis: "condition", key: "Heavy",
        modifier_type: "flat_amount", value: 40, display_label: "Heavy", is_active: true,
      },
    ];
    const result = computeQuote(
      { service_type_id: SERVICE_ID, condition_level: "Heavy" },
      services,
      rules,
      legacyConditions,
      0,
      fields,
      multipliers
    );
    // base 100 + multiplier 40 only — legacy 75 ignored
    expect(result.subtotal).toBe(140);
    const condItems = result.lineItems.filter((i) => i.type === "condition");
    expect(condItems).toHaveLength(1);
    expect(condItems[0].total_price).toBe(40);
  });
});

describe("computeQuote — tax calculation", () => {
  it("computes tax at given rate and adds to total", () => {
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 4 },
      services, rules, [], 10, fields, []
    );
    // subtotal 100 + 100 = 200, tax 10% = 20, total 220
    expect(result.subtotal).toBe(200);
    expect(result.tax).toBe(20);
    expect(result.total).toBe(220);
  });

  it("zero tax rate produces zero tax", () => {
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 1 },
      services, rules, [], 0, fields, []
    );
    expect(result.tax).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });

  it("handles fractional tax rates correctly", () => {
    const result = computeQuote(
      { service_type_id: SERVICE_ID, bedrooms: 1 },
      services, rules, [], 8.25, fields, []
    );
    // subtotal 125, tax = round(125 * 8.25)/100 = round(1031.25)/100 = 10.31 → rounded to 10
    expect(result.subtotal).toBe(125);
    expect(result.tax).toBe(Math.round((125 * 8.25) / 100));
  });
});
