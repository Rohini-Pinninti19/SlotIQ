export type ClarificationStep = "duration" | "attendees";

export type ClarificationState = {
  baseInput: string;
  step: ClarificationStep;
};

const durationPattern = /\b\d+\s*-?\s*(?:minute|min|hour|hr)s?\b/i;
const attendeePattern = /\b(?:alice|bob|carol|dave|eve|frank)\b/i;

export function nextClarification(input: string, state?: ClarificationState) {
  const durationKnown = durationPattern.test(input);
  const attendeesKnown = attendeePattern.test(input) || /\b(?:with|attendees?)\b/i.test(input);
  if (!state) {
    if (!durationKnown) return { state: { baseInput: input, step: "duration" as const }, question: "How long should the meeting be? For example, 30 minutes." };
    if (!attendeesKnown) return { state: { baseInput: input, step: "attendees" as const }, question: "Who should attend? Please name one or more teammates." };
    return null;
  }
  const merged = `${state.baseInput} ${input}`.trim();
  if (state.step === "duration" && !durationPattern.test(merged)) {
    return { state, question: "Please provide a duration such as 30 minutes, or type “use best judgment”." };
  }
  if (state.step === "duration" && !attendeePattern.test(merged) && !/\b(?:with|attendees?)\b/i.test(merged)) {
    return { state: { baseInput: merged, step: "attendees" as const }, question: "Who should attend? Please name one or more teammates." };
  }
  if (state.step === "attendees" && !attendeePattern.test(merged)) {
    return { state, question: "Please name at least one teammate: Alice, Bob, Carol, Dave, Eve, or Frank." };
  }
  return null;
}
