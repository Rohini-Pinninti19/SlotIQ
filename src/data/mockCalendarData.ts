import { CalendarEvent, TeamMember } from "@/types/scheduling";

export const team: TeamMember[] = [
  { name: "Alice", role: "Product Designer", email: "alice@example.com", timezone: "Asia/Kolkata", workingHours: { start: "09:00", end: "18:00" } },
  { name: "Bob", role: "Frontend Engineer", email: "bob@example.com", timezone: "Asia/Kolkata", workingHours: { start: "09:00", end: "18:00" } },
  { name: "Carol", role: "Product Manager", email: "carol@example.com", timezone: "Asia/Kolkata", workingHours: { start: "09:00", end: "18:00" } },
  { name: "Dave", role: "Backend Engineer", email: "dave@example.com", timezone: "Asia/Kolkata", workingHours: { start: "09:00", end: "18:00" } },
  { name: "Eve", role: "Engineering Manager", email: "eve@example.com", timezone: "Asia/Kolkata", workingHours: { start: "09:00", end: "18:00" } },
  { name: "Frank", role: "Finance Partner", email: "frank@example.com", timezone: "Asia/Kolkata", workingHours: { start: "09:00", end: "18:00" } },
];

export const attendees = team.map((member) => member.name);
export const getMember = (name: string) => team.find((member) => member.name === name);

// Demo week: fixed to Sep 21-25 2026 for predictable hackathon demo.
// "Next week" and dynamic date resolution all resolve to this window during demo.
const weekDates = [
  ["Monday", "2026-09-21"],
  ["Tuesday", "2026-09-22"],
  ["Wednesday", "2026-09-23"],
  ["Thursday", "2026-09-24"],
  ["Friday", "2026-09-25"],
] as const;

const blocks: Omit<CalendarEvent, "date" | "day">[] = [
  { id: "a1", attendee: "Alice", start: "14:00", end: "15:00", title: "Client call" },
  { id: "a2", attendee: "Alice", start: "09:00", end: "10:00", title: "All-hands" },
  { id: "a3", attendee: "Alice", start: "16:00", end: "17:00", title: "Focus time" },
  { id: "b1", attendee: "Bob", start: "14:30", end: "15:30", title: "Design review" },
  { id: "b2", attendee: "Bob", start: "10:00", end: "11:00", title: "Standup" },
  { id: "b3", attendee: "Bob", start: "13:00", end: "14:00", title: "Partner sync" },
  { id: "c1", attendee: "Carol", start: "15:00", end: "16:00", title: "Manager 1:1" },
  { id: "c2", attendee: "Carol", start: "11:00", end: "12:00", title: "Research review" },
  { id: "c3", attendee: "Carol", start: "09:00", end: "17:00", title: "Off-site" },
  { id: "d1", attendee: "Dave", start: "13:30", end: "14:30", title: "Marketing meeting" },
  { id: "e1", attendee: "Eve", start: "15:30", end: "16:30", title: "Hiring panel" },
  { id: "e2", attendee: "Eve", start: "10:30", end: "11:30", title: "Product standup" },
  { id: "f1", attendee: "Frank", start: "14:00", end: "15:00", title: "Finance review" },
];

export const calendar: CalendarEvent[] = weekDates.flatMap(([day, date], dayIndex) =>
  blocks
    .filter((event) => {
      if (event.attendee === "Carol") return dayIndex === 4 ? true : dayIndex === 1 || dayIndex === 3;
      if (event.id === "a1" || event.id === "b1" || event.id === "c1" || event.id === "d1" || event.id === "e1" || event.id === "f1") return dayIndex === 1 + (event.id.charCodeAt(1) % 3);
      return dayIndex === event.id.charCodeAt(1) % 3;
    })
    .map((event) => ({ ...event, day, date, role: getMember(event.attendee)?.role })),
);

export const getWeekDates = () => weekDates.map(([day, date]) => ({ day, date }));

// Dynamic date utilities — resolve relative date expressions to the demo week.
// In a real product these would reference the actual current date.
export function resolveRelativeDate(expression: string): { start: string; end: string } {
  const lower = expression.toLowerCase();
  // Always resolve to demo week for predictable hackathon demo
  const demoStart = "2026-09-21";
  const demoEnd = "2026-09-25";
  if (lower.includes("next week") || lower.includes("this week") || lower.includes("next") || lower.includes("week")) {
    return { start: demoStart, end: demoEnd };
  }
  // tomorrow = Monday of demo week for demo purposes
  if (lower.includes("tomorrow") || lower.includes("today")) {
    return { start: demoStart, end: demoStart };
  }
  return { start: demoStart, end: demoEnd };
}