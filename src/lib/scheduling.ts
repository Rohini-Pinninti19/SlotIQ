import { attendees as knownAttendees, calendar, getWeekDates, team, resolveRelativeDate } from "@/data/mockCalendarData";
import { Constraints, Slot, CalendarEvent, Severity } from "@/types/scheduling";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const toMinutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const formatTime = (value: string) => { const [h, m] = value.split(":").map(Number); const suffix = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`; };
const overlaps = (start: string, end: string, event: CalendarEvent) => toMinutes(start) < toMinutes(event.end) && toMinutes(end) > toMinutes(event.start);
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const weekdays = dayNames.slice(1, 6);

export function validateConstraints(value: unknown): Constraints {
  if (!value || typeof value !== "object") throw new Error("Scheduling constraints are missing.");
  const constraints = value as Partial<Constraints>;
  if (!Number.isInteger(constraints.duration) || !constraints.duration || constraints.duration < 5 || constraints.duration > 480) throw new Error("Meeting duration must be between 5 minutes and 8 hours.");
  if (!Array.isArray(constraints.attendees) || constraints.attendees.length === 0) throw new Error("Add at least one attendee.");
  if (new Set(constraints.attendees).size !== constraints.attendees.length) throw new Error("Each attendee can only be selected once.");
  if (constraints.attendees.some((attendee) => typeof attendee !== "string" || !knownAttendees.includes(attendee))) throw new Error("One or more attendees are not available in the demo calendar.");
  if (!Array.isArray(constraints.preferredDays) || constraints.preferredDays.some((day) => !weekdays.includes(day))) throw new Error("Preferred days must be weekdays.");
  if (!Array.isArray(constraints.excludedDays) || constraints.excludedDays.some((day) => !weekdays.includes(day))) throw new Error("Excluded days must be weekdays.");
  if (!Array.isArray(constraints.preferredTimes) || !Array.isArray(constraints.excludedTimes)) throw new Error("Please provide valid preferred and excluded time ranges.");
  for (const range of [...constraints.preferredTimes, ...constraints.excludedTimes]) if (!range || !validTime(range.start) || !validTime(range.end) || toMinutes(range.start) >= toMinutes(range.end)) throw new Error("Please use valid time ranges such as 09:00–12:00.");
  if (!constraints.dateRange?.start || !constraints.dateRange?.end || !validDate(constraints.dateRange.start) || !validDate(constraints.dateRange.end) || constraints.dateRange.start > constraints.dateRange.end) throw new Error("Please use a valid date range.");
  if (typeof constraints.meetingPurpose !== "string" || !constraints.meetingPurpose.trim()) throw new Error("Add a meeting purpose.");
  if (typeof constraints.location !== "string" || typeof constraints.additionalNotes !== "string") throw new Error("Meeting details must be valid text.");
  return constraints as Constraints;
}

export function validateSlot(value: unknown): Slot {
  if (!value || typeof value !== "object") throw new Error("A meeting slot is required.");
  const slot = value as Partial<Slot>;
  if (!slot.date || !validDate(slot.date) || !slot.start || !validTime(slot.start) || !slot.end || !validTime(slot.end) || toMinutes(slot.start) >= toMinutes(slot.end)) {
    throw new Error("A valid meeting slot is required.");
  }
  if (typeof slot.label !== "string" || !Array.isArray(slot.available) || !Array.isArray(slot.conflicts)) throw new Error("A complete meeting slot is required.");
  return slot as Slot;
}

export const defaultConstraints = (): Constraints => ({
  duration: 45, attendees: ["Alice", "Bob", "Carol", "Dave"], preferredDays: [],
  preferredTimes: [{ start: "13:00", end: "17:00" }], excludedDays: ["Friday"],
  excludedTimes: [{ start: "12:00", end: "13:00", reason: "lunch" }], excludedPeople: [],
  meetingPurpose: "Project review", location: "", dateRange: resolveRelativeDate("next week"),
  additionalNotes: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
});

export function getRestoredDays(input: string): string[] {
  return dayNames.slice(1, 6).filter((day) =>
    new RegExp(`(?:remove|removes|removed|clear|cleared|delete|drop)\\s+(?:the\\s+)?(?:exclusion|excluded\\s+day|exclude|excluded|avoiding?|restriction)?\\s*(?:for|on)?\\s*${day}`, "i").test(input)
    || new RegExp(`(?:don't|do\\s+not|no\\s+longer|stop)\\s+(?:exclude|excluding|avoid|avoiding)\\s+(?:on\\s+)?${day}`, "i").test(input)
    || new RegExp(`(?:include|including|allow|allowed|add)\\s+(?:on\\s+)?${day}`, "i").test(input),
  );
}

/** Parse location from natural language input */
function parseLocation(input: string): string {
  const lower = input.toLowerCase();
  // Explicit location phrases
  const locationMatch = input.match(/(?:in|at|@|room|conference|hall|auditorium)\s+([A-Z][^.,!?]{2,40}?)(?:\s*[.,!?]|\s+(?:with|on|next|for|tomorrow|at \d)|$)/i);
  if (locationMatch) {
    const loc = locationMatch[1].trim();
    // Filter out time expressions and names
    if (!/^\d/.test(loc) && !/^(alice|bob|carol|dave|eve|frank)$/i.test(loc)) return loc;
  }
  // Online meeting keywords
  if (/\b(online|virtual|remote|google meet|zoom|teams|video call)\b/.test(lower)) return "Google Meet (online)";
  // Conference room pattern
  const roomMatch = input.match(/(?:Conference\s+Room|Room|Lab|Studio|Hall|Auditorium)\s+([A-Z0-9][^.,!?\s]{0,10})/i);
  if (roomMatch) return roomMatch[0].trim();
  return "";
}

/** Classify meeting type from purpose and input */
export function classifyMeetingType(purpose: string, input: string): string {
  const text = `${purpose} ${input}`.toLowerCase();
  if (/brainstorm|idea|ideation/.test(text)) return "brainstorm";
  if (/design review|design critique|ux review/.test(text)) return "design-review";
  if (/api sync|api meeting|technical sync|tech sync/.test(text)) return "api-sync";
  if (/standup|stand-up|stand up|daily/.test(text)) return "standup";
  if (/kickoff|kick-off|kick off/.test(text)) return "kickoff";
  if (/interview|candidate/.test(text)) return "interview";
  if (/planning|sprint|roadmap/.test(text)) return "planning";
  if (/1:1|one.on.one|1-1/.test(text)) return "one-on-one";
  if (/sync|check.in|check in/.test(text)) return "sync";
  return "general";
}

export function parseRequest(input: string): Constraints {
  const lower = input.toLowerCase();
  const durationMatch = lower.match(/(\d+)\s*-?\s*(?:minute|min|hour|hr)/);
  const duration = durationMatch ? Number(durationMatch[1]) * (/hour|hr/.test(durationMatch[0]) ? 60 : 1) : 30;
  const roleMatches = team.filter((member) => lower.includes(member.role.toLowerCase()) || (member.role.toLowerCase().includes("backend") && lower.includes("backend team")) || (member.role.toLowerCase().includes("frontend") && lower.includes("frontend team"))).map((member) => member.name);
  const mentioned = [...new Set([...knownAttendees.filter((name) => lower.includes(name.toLowerCase())), ...roleMatches])];
  const attendeePhrase = input.match(/(?:with|attendees?\s*:?)\s+([^.!?]+?)(?:\s+(?:next|on|for|to|prefer|avoid|but|and)\b|[.!?]|$)/i)?.[1] || "";
  const unknownAttendees = attendeePhrase.split(/,|\band\b/i).map((name) => name.trim()).filter((name) => name && !/^(the|a|an|me|us|team|everyone)$/i.test(name) && !knownAttendees.some((known) => name.toLowerCase().includes(known.toLowerCase())));
  if (unknownAttendees.length && mentioned.length === 0) throw new Error(`I couldn't find "${unknownAttendees.join('", "')}" in the demo calendars. Available attendees: Alice, Bob, Carol, Dave, Eve, Frank.`);
  const parsedAttendees = mentioned.length ? mentioned : ["Alice", "Bob", "Carol", "Dave"];
  const preferredDays = dayNames.slice(1, 6).filter((day) => lower.includes(day.toLowerCase()));
  const excludedDays = dayNames.slice(1, 6).filter((day) => new RegExp(`(?:avoid|no|exclude|excluding)[^.!?]{0,30}${day}`, "i").test(input));
  const restoredDays = getRestoredDays(input);
  const exactTime = lower.match(/(?:at|around|from)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  const exactStart = exactTime ? (() => { const hour = Number(exactTime[1]) % 12 + (exactTime[3]?.toLowerCase() === "pm" ? 12 : 0); return `${String(hour).padStart(2, "0")}:${exactTime[2] || "00"}`; })() : "";
  const preferredTimes = exactStart ? [{ start: exactStart, end: toTime(Math.min(toMinutes(exactStart) + duration, 18 * 60)) }] : lower.includes("morning") ? [{ start: "09:00", end: "12:00" }] : lower.includes("evening") ? [{ start: "17:00", end: "19:00" }] : [{ start: "13:00", end: "17:00" }];
  const purposeMatch = input.match(/(?:to|for|about|regarding)\s+(?:a\s+)?(.+?)(?:\s+(?:next week|on|this week|in the|sometime|but|and)\b|\.|$)/i);
  const meetingPurpose = purposeMatch?.[1]?.trim() || (lower.includes("brainstorm") ? "Brainstorming session" : lower.includes("sync") ? "Team sync" : lower.includes("review") ? "Project review" : lower.includes("standup") ? "Daily standup" : "Project review");
  const excludedTimes = lower.includes("lunch") ? [{ start: "12:00", end: "13:00", reason: "lunch" }] : lower.includes("before eod") ? [{ start: "17:00", end: "18:00", reason: "after end of day" }] : defaultConstraints().excludedTimes;

  // Dynamic date resolution — resolves "next week", "tomorrow", "today" to demo dates
  const dateRange = resolveRelativeDate(input);
  const location = parseLocation(input);

  const constraints = {
    ...defaultConstraints(),
    duration,
    attendees: parsedAttendees,
    preferredDays: preferredDays.filter((day) => !excludedDays.includes(day) || restoredDays.includes(day)),
    excludedDays: excludedDays.filter((day) => !restoredDays.includes(day)),
    excludedTimes,
    preferredTimes,
    meetingPurpose: meetingPurpose.charAt(0).toUpperCase() + meetingPurpose.slice(1),
    dateRange,
    additionalNotes: input,
    location,
  };
  return validateConstraints(constraints);
}

function preferenceScore(slot: { day: string; start: string; end: string }, constraints: Constraints) {
  let score = 0;
  const preferred = constraints.preferredTimes.some((range) => toMinutes(slot.start) >= toMinutes(range.start) && toMinutes(slot.end) <= toMinutes(range.end));
  if (preferred) score += 20;
  if (constraints.preferredDays.length === 0 || constraints.preferredDays.includes(slot.day)) score += 10;
  if (constraints.excludedDays.includes(slot.day)) score -= 20;
  if (constraints.excludedTimes.some((range) => overlaps(slot.start, slot.end, { start: range.start, end: range.end } as CalendarEvent))) score -= 15;
  return Math.max(0, score);
}

export function findSlots(constraints: Constraints): Slot[] {
  const dates = getWeekDates().filter(({ day, date }) =>
    date >= constraints.dateRange.start &&
    date <= constraints.dateRange.end &&
    !constraints.excludedDays.includes(day),
  );
  const candidates: Slot[] = [];
  for (const { day, date } of dates) for (let minutes = 9 * 60; minutes <= 17 * 60 - constraints.duration; minutes += 30) {
    const start = toTime(minutes), end = toTime(minutes + constraints.duration);
    const conflicts = constraints.attendees.flatMap((attendee) => calendar.filter((event) => event.attendee === attendee && event.date === date && overlaps(start, end, event)).map((event) => ({ attendee, event, duration: Math.min(toMinutes(end), toMinutes(event.end)) - Math.max(toMinutes(start), toMinutes(event.start)) })));
    const available = constraints.attendees.filter((attendee) => !conflicts.some((conflict) => conflict.attendee === attendee));
    const availabilityScore = Math.round((available.length / Math.max(1, constraints.attendees.length)) * 70);
    const excluded = constraints.excludedTimes.some((range) => overlaps(start, end, { start: range.start, end: range.end } as CalendarEvent));
    if (excluded) continue;
    const preference = preferenceScore({ day, start, end }, constraints);
    const severity: Severity = conflicts.length === 0 ? "low" : conflicts.length === 1 ? "medium" : "high";
    const fitScore = Math.max(0, Math.min(100, availabilityScore + preference));
    const fairness = minutes >= 10 * 60 && minutes <= 16 * 60 ? "High" : minutes < 10 * 60 || minutes > 17 * 60 ? "Low" : "Moderate";
    const reason = conflicts.length === 0
      ? `${constraints.preferredDays.length && constraints.preferredDays.includes(day) ? "Preferred day and " : ""}${preference >= 20 ? "preferred time window" : "clear calendars for all attendees"}.`
      : conflicts.map((conflict) => {
          const member = team.find(m => m.name === conflict.attendee);
          const role = member?.role || conflict.event.role || "team member";
          return `${conflict.attendee} (${role}) has "${conflict.event.title}" from ${formatTime(conflict.event.start)} to ${formatTime(conflict.event.end)} (${conflict.duration}m overlap)`;
        }).join("; ") + ".";
    candidates.push({ id: `${date}-${start}`, date, day, start, end, label: `${day}, ${formatTime(start)} – ${formatTime(end)}`, available, conflicts, fitScore, availabilityScore, preferenceScore: preference, fairness, severity, reason });
  }
  const ranked = candidates.sort((a, b) => b.fitScore - a.fitScore || a.conflicts.length - b.conflicts.length || a.start.localeCompare(b.start));
  const top = ranked.slice(0, 5);
  const bestConflict = ranked.find((candidate) => candidate.conflicts.length > 0);
  if (bestConflict && !top.some((candidate) => candidate.id === bestConflict.id)) top[top.length - 1] = bestConflict;
  return top;
}

export const displayTime = formatTime;