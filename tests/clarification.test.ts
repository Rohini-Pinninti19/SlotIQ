import { describe, expect, it } from "vitest";
import { nextClarification } from "@/lib/clarification";

describe("clarification state machine", () => {
  it("asks for duration first, then attendees, and completes with both answers", () => {
    const duration = nextClarification("Schedule a design review next week");
    expect(duration?.state.step).toBe("duration");

    const attendees = nextClarification("45 minutes", duration?.state);
    expect(attendees?.state.step).toBe("attendees");

    expect(nextClarification("Alice and Bob", attendees?.state)).toBeNull();
  });

  it("does not ask questions when required information is already present", () => {
    expect(nextClarification("Schedule a 30-minute review with Alice tomorrow")).toBeNull();
  });
});
