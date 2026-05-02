import { describe, it, expect } from "vitest";
import { format, addDays, subDays } from "date-fns";

/**
 * Mirrors the date-guard used by `handleRescheduleConfirm` in BookingsAdmin.tsx.
 * Kept here as a pure unit-testable function so we can verify the rule
 * without spinning up React + Supabase mocks.
 */
const validateRescheduleDate = (rescheduleDate: string): { ok: boolean; reason?: string } => {
  if (!rescheduleDate) return { ok: false, reason: "EMPTY" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const proposed = new Date(`${rescheduleDate}T00:00:00`);
  if (isNaN(proposed.getTime())) return { ok: false, reason: "INVALID" };
  if (proposed < today) return { ok: false, reason: "BACKDATING_NOT_ALLOWED" };
  return { ok: true };
};

describe("Reschedule date guard — No Backdating", () => {
  it("rejects a yesterday date", () => {
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const r = validateRescheduleDate(yesterday);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("BACKDATING_NOT_ALLOWED");
  });

  it("rejects a clearly past date (2020-01-01)", () => {
    expect(validateRescheduleDate("2020-01-01").ok).toBe(false);
  });

  it("accepts today's date", () => {
    const today = format(new Date(), "yyyy-MM-dd");
    expect(validateRescheduleDate(today).ok).toBe(true);
  });

  it("accepts a future date", () => {
    const future = format(addDays(new Date(), 7), "yyyy-MM-dd");
    expect(validateRescheduleDate(future).ok).toBe(true);
  });

  it("rejects empty / invalid input", () => {
    expect(validateRescheduleDate("").ok).toBe(false);
    expect(validateRescheduleDate("not-a-date").ok).toBe(false);
  });
});
