import { Agenda, Constraints, InviteDraft, Slot } from "@/types/scheduling";
import { team } from "@/data/mockCalendarData";

const MEETING_TEMPLATES: Record<string, (duration: number, purpose: string, attendees: string[]) => { items: { topic: string; duration: number; description: string }[]; objectives: string[] }> = {
  "brainstorm": (d, purpose) => {
    const a = Math.max(5, Math.round(d * 0.1));
    const b = Math.max(10, Math.round(d * 0.2));
    const c = Math.max(10, Math.round(d * 0.4));
    const e = d - a - b - c;
    return {
      objectives: [`Generate new ideas for ${purpose.toLowerCase()}`, "Evaluate and prioritize top ideas", "Assign owners for next steps"],
      items: [
        { topic: "Objective & context", duration: a, description: "Set the creative brief and goals for this session." },
        { topic: "Current landscape", duration: b, description: "Quick overview of where things stand and constraints." },
        { topic: "Idea generation", duration: c, description: "Open brainstorm — all ideas welcome, no filtering yet." },
        { topic: "Evaluation & next steps", duration: e, description: "Narrow ideas, assign owners, agree on follow-ups." },
      ],
    };
  },
  "design-review": (d, purpose) => {
    const a = Math.max(5, Math.round(d * 0.1));
    const b = Math.max(10, Math.round(d * 0.5));
    const c = Math.max(5, Math.round(d * 0.2));
    const e = d - a - b - c;
    return {
      objectives: [`Review current design for ${purpose.toLowerCase()}`, "Collect structured feedback", "Record decisions and action items"],
      items: [
        { topic: "Design walkthrough", duration: a, description: "Present the current design work and goals." },
        { topic: "Feedback round", duration: b, description: "Structured critique: what works, what needs improvement." },
        { topic: "Decisions", duration: c, description: "Agree on changes and direction." },
        { topic: "Action items", duration: e, description: "Assign follow-up tasks with owners and due dates." },
      ],
    };
  },
  "api-sync": (d) => {
    const a = Math.max(5, Math.round(d * 0.15));
    const b = Math.max(5, Math.round(d * 0.3));
    const c = Math.max(5, Math.round(d * 0.25));
    const e = d - a - b - c;
    return {
      objectives: ["Review API integration status", "Surface and resolve blockers", "Align on next integration milestones"],
      items: [
        { topic: "API status update", duration: a, description: "Current state of the API: endpoints, coverage, known issues." },
        { topic: "Blockers & integration issues", duration: b, description: "Walk through current blockers and technical debt." },
        { topic: "Decisions needed", duration: c, description: "Resolve open questions affecting integration progress." },
        { topic: "Next steps", duration: e, description: "Assign owners for outstanding tasks and set next sync date." },
      ],
    };
  },
  "standup": (d) => {
    const third = Math.max(1, Math.floor(d / 3));
    const rest = d - third * 2;
    return {
      objectives: ["Share progress since last standup", "Surface blockers early", "Align on today's priorities"],
      items: [
        { topic: "What was done", duration: third, description: "Each attendee shares completed work since last standup." },
        { topic: "What's planned today", duration: third, description: "Today's focus and goals." },
        { topic: "Blockers", duration: rest, description: "Any blockers the team should know about or help with." },
      ],
    };
  },
  "kickoff": (d, purpose) => {
    const a = Math.max(5, Math.round(d * 0.15));
    const b = Math.max(5, Math.round(d * 0.2));
    const c = Math.max(5, Math.round(d * 0.2));
    const e = Math.max(5, Math.round(d * 0.25));
    const f = d - a - b - c - e;
    return {
      objectives: [`Align on ${purpose.toLowerCase()} goals and scope`, "Clarify roles and responsibilities", "Agree on timeline and success metrics"],
      items: [
        { topic: "Project overview", duration: a, description: "Background, problem statement, and why this matters." },
        { topic: "Goals & success metrics", duration: b, description: "What does success look like? How will we measure it?" },
        { topic: "Roles & responsibilities", duration: c, description: "Who owns what? Clarify accountabilities." },
        { topic: "Timeline & milestones", duration: e, description: "Key dates, dependencies, and delivery schedule." },
        { topic: "Risks & next steps", duration: f, description: "Known risks, mitigations, and immediate action items." },
      ],
    };
  },
  "planning": (d, purpose) => {
    const a = Math.max(5, Math.round(d * 0.15));
    const b = Math.max(10, Math.round(d * 0.4));
    const c = Math.max(5, Math.round(d * 0.2));
    const e = d - a - b - c;
    return {
      objectives: [`Plan upcoming work for ${purpose.toLowerCase()}`, "Agree on capacity and priorities", "Commit to deliverables"],
      items: [
        { topic: "Sprint goals", duration: a, description: "What are we committing to this sprint?" },
        { topic: "Backlog review & estimates", duration: b, description: "Walk through priority items, estimate effort, discuss dependencies." },
        { topic: "Capacity check", duration: c, description: "Who is available? Factor in PTO and other commitments." },
        { topic: "Commitments & action items", duration: e, description: "Finalize sprint commitment and assign owners." },
      ],
    };
  },
  "general": (d, purpose) => {
    const a = Math.max(5, Math.round(d * 0.15));
    const b = Math.max(5, Math.round(d * 0.45));
    const c = d - a - b;
    return {
      objectives: [`Align on the outcome for ${purpose.toLowerCase()}`, "Surface decisions, risks, and open questions", "Leave with clear owners and next steps"],
      items: [
        { topic: "Context & objectives", duration: a, description: "Set context and confirm what a successful meeting delivers." },
        { topic: "Working discussion", duration: b, description: `Work through the key topics for ${purpose.toLowerCase()}.` },
        { topic: "Decisions & next steps", duration: c, description: "Capture decisions, owners, and follow-up actions." },
      ],
    };
  },
};

export function generateAgenda(constraints: Constraints, slot: Slot, meetingType = "general"): Agenda {
  const template = MEETING_TEMPLATES[meetingType] || MEETING_TEMPLATES["general"];
  const { items, objectives } = template(constraints.duration, constraints.meetingPurpose, constraints.attendees);
  // Ensure durations sum correctly
  const sum = items.reduce((s, i) => s + i.duration, 0);
  if (sum !== constraints.duration && items.length > 0) {
    items[items.length - 1].duration += constraints.duration - sum;
  }
  const prepNames = constraints.attendees.slice(0, 3).map(name => {
    const m = team.find(t => t.name === name);
    return m ? `${m.name} (${m.role})` : name;
  }).join(", ");
  return {
    title: constraints.meetingPurpose,
    objectives,
    items,
    preparationNotes: constraints.additionalNotes || `${prepNames} — please review any materials related to ${constraints.meetingPurpose.toLowerCase()} before ${slot.day}.`,
    meetingType,
  };
}

export function draftInvite(constraints: Constraints, slot: Slot, agenda: Agenda): InviteDraft {
  const subject = `${agenda.title} | ${slot.day}, ${slot.start}`;
  const attendeesWithRoles = constraints.attendees.map(name => {
    const m = team.find(t => t.name === name);
    return m ? `${m.name} (${m.role})` : name;
  }).join(", ");
  const agendaLines = agenda.items.map((item, i) => `${i + 1}. ${item.topic} (${item.duration} min) — ${item.description}`);
  const body = [
    `Hi team,`,
    ``,
    `You are invited to ${agenda.title}.`,
    `When: ${slot.label} (${constraints.duration} minutes)`,
    `Google Meet: MEET_LINK_PLACEHOLDER`,
    ...(constraints.location ? [`Location: ${constraints.location}`] : []),
    `Attendees: ${attendeesWithRoles}`,
    ``,
    `Objectives:`,
    ...agenda.objectives.map((o, i) => `${i + 1}. ${o}`),
    ``,
    `Agenda:`,
    ...agendaLines,
    ``,
    `Preparation: ${agenda.preparationNotes}`,
    ``,
    `Best,`,
  ].join("\n");
  return {
    subject,
    body,
    meetLink: "https://meet.google.com/new",
    googleStatus: "not_connected",
  };
}