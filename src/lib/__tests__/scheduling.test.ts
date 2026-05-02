import { describe, it, expect } from "vitest";

/**
 * Mirrors the SQL `parse_time_slot` + `check_slot_overlap` RPCs in pure TS
 * so we can validate the overlap algorithm without a live DB. Any change to
 * server-side time parsing must be reflected here.
 */

type Range = { start: number; end: number }; // minutes since midnight

const to24h = (h: number, ampm: string): number => {
  const meridiem = ampm.toUpperCase();
  if (meridiem === "AM") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
};

export const parseTimeSlot = (slot: string): Range => {
  const s = slot.trim();
  // "10:00 AM - 12:00 PM" or "11:00 AM"
  const range = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (range) {
    const start = to24h(+range[1], range[3]) * 60 + +range[2];
    const end = to24h(+range[4], range[6]) * 60 + +range[5];
    return { start, end };
  }
  const single = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (single) {
    const start = to24h(+single[1], single[3]) * 60 + +single[2];
    // Default duration 60 minutes — matches RPC fallback
    return { start, end: start + 60 };
  }
  throw new Error(`Unparseable slot: ${slot}`);
};

export const checkSlotOverlap = (a: string, b: string): boolean => {
  const ra = parseTimeSlot(a);
  const rb = parseTimeSlot(b);
  // Half-open intervals: [start, end) — touching boundaries do NOT overlap
  return ra.start < rb.end && rb.start < ra.end;
};

describe("parseTimeSlot", () => {
  it("parses range string", () => {
    expect(parseTimeSlot("10:00 AM - 12:00 PM")).toEqual({ start: 600, end: 720 });
  });
  it("parses single time with 60-minute default duration", () => {
    expect(parseTimeSlot("11:00 AM")).toEqual({ start: 660, end: 720 });
  });
  it("handles 12 AM / 12 PM correctly", () => {
    expect(parseTimeSlot("12:00 AM").start).toBe(0);
    expect(parseTimeSlot("12:00 PM").start).toBe(720);
  });
});

describe("checkSlotOverlap", () => {
  it("flags overlap when single-time falls inside a range", () => {
    expect(checkSlotOverlap("10:00 AM - 12:00 PM", "11:00 AM")).toBe(true);
  });
  it("flags overlap between two intersecting ranges", () => {
    expect(checkSlotOverlap("10:00 AM - 12:00 PM", "11:30 AM - 1:00 PM")).toBe(true);
  });
  it("does NOT flag adjacent (touching) slots", () => {
    expect(checkSlotOverlap("10:00 AM - 12:00 PM", "12:00 PM")).toBe(false);
    expect(checkSlotOverlap("10:00 AM - 12:00 PM", "12:00 PM - 1:00 PM")).toBe(false);
  });
  it("does NOT flag slots fully separated", () => {
    expect(checkSlotOverlap("9:00 AM - 10:00 AM", "11:00 AM - 12:00 PM")).toBe(false);
  });
  it("flags overlap when ranges are identical", () => {
    expect(checkSlotOverlap("2:00 PM - 4:00 PM", "2:00 PM - 4:00 PM")).toBe(true);
  });
});
