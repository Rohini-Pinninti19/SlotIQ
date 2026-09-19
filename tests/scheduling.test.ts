import { describe, expect, it } from "vitest";
import { defaultConstraints, findSlots, parseRequest, validateConstraints } from "@/lib/scheduling";

describe("validateConstraints", () => {
  it("rejects duplicate or unknown attendees", () => {
    expect(() => validateConstraints({ ...defaultConstraints(), attendees: ["Alice", "Alice"] })).toThrow("once");
    expect(() => validateConstraints({ ...defaultConstraints(), attendees: ["Unknown"] })).toThrow("not available");
  });

  it("rejects malformed dates and time ranges", () => {
    expect(() => validateConstraints({ ...defaultConstraints(), dateRange: { start: "2026-09-31", end: "2026-10-01" } })).toThrow("valid date");
    expect(() => validateConstraints({ ...defaultConstraints(), preferredTimes: [{ start: "15:00", end: "14:00" }] })).toThrow("valid time");
  });
});

describe("parseRequest", () => {
  it("resolves a weekday request to the matching demo date", () => {
    const constraints = parseRequest("Schedule a 15-minute API sync with Dave on Tuesday afternoon.");
    expect(constraints.attendees).toEqual(["Dave"]);
    expect(constraints.dateRange).toEqual({ start: "2026-09-22", end: "2026-09-22" });
  });

  it("parses hours as minutes and preserves attendee selection", () => {
    const constraints = parseRequest("I need a 1-hour brainstorming session with Alice, Bob and Carol next week.");
    expect(constraints.duration).toBe(60);
    expect(constraints.attendees).toEqual(["Alice", "Bob", "Carol"]);
  });
});

describe("findSlots", () => {
  it("returns ranked slots with explicit conflicts and available attendees", () => {
    const slots = findSlots(defaultConstraints());
    expect(slots).toHaveLength(5);
    expect(slots[0].fitScore).toBeGreaterThanOrEqual(slots[1].fitScore);
    expect(slots.every((slot) => slot.available.length + new Set(slot.conflicts.map((conflict) => conflict.attendee)).size === 4)).toBe(true);
    expect(slots.some((slot) => slot.conflicts.length > 0)).toBe(true);
  });

  it("does not return slots outside the requested date range", () => {
    const slots = findSlots({ ...defaultConstraints(), dateRange: { start: "2026-09-22", end: "2026-09-22" } });
    expect(slots.every((slot) => slot.date === "2026-09-22")).toBe(true);
  });
});
