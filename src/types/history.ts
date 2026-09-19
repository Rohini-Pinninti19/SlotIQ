import { Agenda, Constraints, Slot } from "@/types/scheduling";

export type MeetingRecord = {
  id: string;
  createdAt: string;
  title: string;
  date: string;
  attendees: string[];
  status: "scheduled" | "draft";
  fitScore: number;
  conflictCount: number;
  attendeeConflictCounts: Record<string, number>;
  constraints: Constraints;
  slot: Slot;
  agenda?: Agenda;
};
