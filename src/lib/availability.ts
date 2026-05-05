// Smart buffer-aware availability helpers.
// Parses time-slot strings like "9:00 AM - 11:00 AM" or "9:00 AM" and returns
// minute ranges; computes blocked slots based on buffer and default duration.

export interface AvailabilityConfig {
  bufferMinutes: number;
  defaultDurationMinutes: number;
}

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  bufferMinutes: 30,
  defaultDurationMinutes: 120,
};

export function configFromSettings(settings: Record<string, string> | undefined | null): AvailabilityConfig {
  const buffer = Number(settings?.buffer_time_minutes);
  const dur = Number(settings?.default_service_duration_minutes);
  return {
    bufferMinutes: Number.isFinite(buffer) && buffer >= 0 ? buffer : DEFAULT_AVAILABILITY.bufferMinutes,
    defaultDurationMinutes: Number.isFinite(dur) && dur > 0 ? dur : DEFAULT_AVAILABILITY.defaultDurationMinutes,
  };
}

// Returns minutes-from-midnight, or null on parse failure.
function parseClock(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export interface SlotRange { start: number; end: number; }

export function parseSlot(slot: string, defaultDurationMinutes: number): SlotRange | null {
  if (!slot) return null;
  const parts = slot.split(/\s*-\s*/);
  if (parts.length === 2) {
    const s = parseClock(parts[0]);
    const e = parseClock(parts[1]);
    if (s == null || e == null) return null;
    return { start: s, end: e > s ? e : s + defaultDurationMinutes };
  }
  const s = parseClock(parts[0]);
  if (s == null) return null;
  return { start: s, end: s + defaultDurationMinutes };
}

// Returns true if the candidate slot collides with any existing booking when
// each is expanded by ±buffer minutes.
export function isSlotBlocked(
  candidate: string,
  bookedSlots: string[] | undefined | null,
  config: AvailabilityConfig,
): boolean {
  const c = parseSlot(candidate, config.defaultDurationMinutes);
  if (!c) return false;
  const cStart = c.start - config.bufferMinutes;
  const cEnd = c.end + config.bufferMinutes;
  for (const b of bookedSlots ?? []) {
    const r = parseSlot(b, config.defaultDurationMinutes);
    if (!r) continue;
    const bStart = r.start - config.bufferMinutes;
    const bEnd = r.end + config.bufferMinutes;
    if (cStart < bEnd && bStart < cEnd) return true;
  }
  return false;
}
