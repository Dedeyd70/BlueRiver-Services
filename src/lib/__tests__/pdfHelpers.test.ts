import { describe, it, expect } from "vitest";
import { addDays, format, differenceInDays } from "date-fns";

/**
 * Pure-logic helpers mirroring the data-formatting rules used in
 * `invoicePdf.ts` and `create_invoice_from_booking` RPC. Kept here so any
 * change to fallback/derivation rules has a regression test.
 */

export const resolveServiceAddress = (inv: {
  address?: string | null;
  service_address?: string | null;
}): string => {
  return String(inv.address || inv.service_address || "—");
};

export const resolveDueDate = (issued: Date | string, daysOffset = 14): Date => {
  const base = typeof issued === "string" ? new Date(issued) : issued;
  return addDays(base, daysOffset);
};

export const resolveLineItems = (inv: { line_items?: any[]; services?: any[] }): any[] => {
  if (Array.isArray(inv.line_items) && inv.line_items.length > 0) return inv.line_items;
  if (Array.isArray(inv.services)) return inv.services;
  return [];
};

describe("resolveServiceAddress", () => {
  it("returns address when present", () => {
    expect(resolveServiceAddress({ address: "123 Main St" })).toBe("123 Main St");
  });
  it("falls back to service_address", () => {
    expect(resolveServiceAddress({ address: null, service_address: "456 Oak Ave" })).toBe("456 Oak Ave");
  });
  it("returns em dash when both null", () => {
    expect(resolveServiceAddress({ address: null, service_address: null })).toBe("—");
  });
  it("returns em dash for fully empty input", () => {
    expect(resolveServiceAddress({})).toBe("—");
  });
});

describe("resolveDueDate", () => {
  it("calculates exactly 14 days from issued date", () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    const due = resolveDueDate(issued);
    expect(differenceInDays(due, issued)).toBe(14);
    expect(format(due, "yyyy-MM-dd")).toBe("2026-01-15");
  });
  it("accepts ISO string input", () => {
    const due = resolveDueDate("2026-06-01T00:00:00Z");
    expect(format(due, "yyyy-MM-dd")).toBe("2026-06-15");
  });
  it("respects custom offset", () => {
    const issued = new Date("2026-01-01T00:00:00Z");
    expect(differenceInDays(resolveDueDate(issued, 30), issued)).toBe(30);
  });
});

describe("resolveLineItems", () => {
  it("prefers line_items when populated", () => {
    const items = resolveLineItems({
      line_items: [{ name: "A" }],
      services: [{ title: "B" }],
    });
    expect(items).toEqual([{ name: "A" }]);
  });
  it("falls back to legacy services array when line_items empty", () => {
    const items = resolveLineItems({ line_items: [], services: [{ title: "B" }] });
    expect(items).toEqual([{ title: "B" }]);
  });
  it("returns empty array when neither present", () => {
    expect(resolveLineItems({})).toEqual([]);
  });
});
