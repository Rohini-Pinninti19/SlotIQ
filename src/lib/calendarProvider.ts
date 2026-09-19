import { CalendarEvent, TeamMember } from "@/types/scheduling";

export type CalendarProvider = {
  name: "demo" | "google" | "microsoft";
  getAvailability(attendees: TeamMember[], start: string, end: string): Promise<CalendarEvent[]>;
  createEvent?: (input: {
    title: string;
    start: string;
    end: string;
    timezone: string;
    attendees: string[];
    location?: string;
  }) => Promise<{ eventId?: string; meetLink?: string }>;
};

export const demoCalendarProvider: CalendarProvider = {
  name: "demo",
  async getAvailability() {
    const { calendar } = await import("@/data/mockCalendarData");
    return calendar;
  },
};
