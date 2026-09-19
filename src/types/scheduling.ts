export type TimeRange = { start: string; end: string; reason?: string };
export type Severity = "low" | "medium" | "high";

export type Constraints = {
  duration: number;
  attendees: string[];
  preferredDays: string[];
  preferredTimes: TimeRange[];
  excludedDays: string[];
  excludedTimes: TimeRange[];
  excludedPeople: string[];
  meetingPurpose: string;
  location: string;
  dateRange: { start: string; end: string };
  additionalNotes: string;
  timezone?: string;
  workingHours?: { start: string; end: string };
};

export type CalendarEvent = {
  id: string;
  attendee: string;
  day: string;
  date: string;
  start: string;
  end: string;
  title: string;
  role?: string;
};

export type TeamMember = {
  name: string;
  role: string;
  email?: string;
  timezone?: string;
  workingHours?: { start: string; end: string };
};

export type Conflict = {
  attendee: string;
  event: CalendarEvent;
  duration: number;
};

export type Slot = {
  id: string;
  date: string;
  day: string;
  start: string;
  end: string;
  label: string;
  available: string[];
  conflicts: Conflict[];
  fitScore: number;
  availabilityScore: number;
  preferenceScore: number;
  fairness: "High" | "Moderate" | "Low";
  severity: Severity;
  reason: string;
};

export type Agenda = {
  title: string;
  objectives: string[];
  items: { topic: string; duration: number; description: string }[];
  preparationNotes: string;
  meetingType?: string;
};

export type InviteDraft = {
  subject: string;
  body: string;
  meetLink?: string;
  googleEventId?: string;
  googleStatus?: "not_connected" | "created" | "failed" | "demo";
  googleError?: string;
  googleEventUrl?: string;
};

export type AiStatus = {
  parserUsed: "ai" | "fallback";
  agendaUsed: "ai" | "fallback";
  conflictExplanationUsed?: "ai" | "fallback";
};