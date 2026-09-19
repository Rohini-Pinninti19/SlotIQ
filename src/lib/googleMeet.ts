export interface MeetingDetails {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: string[];
  agenda: string[];
}

export function generateGoogleMeetLink(): string {
  return "https://meet.google.com/new";
}

function durationInMinutes(startTime: string, endTime: string): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return Math.max(1, toMinutes(endTime) - toMinutes(startTime));
}

export function generateMeetInviteText(details: MeetingDetails): string {
  const duration = durationInMinutes(details.startTime, details.endTime);
  const itemDuration = details.agenda.length ? Math.floor(duration / details.agenda.length) : duration;
  const formattedAgenda = details.agenda
    .map((item, index) => `${index + 1}. ${item} (${itemDuration} min)`)
    .join("\n");
  const attendeeList = details.participants.join(", ");

  return `Subject: Invitation: ${details.title} | ${details.date}, ${details.startTime} – ${details.endTime}

Hi ${attendeeList},

You're invited to the ${details.title}.

• Date: ${details.date}
• Time: ${details.startTime} – ${details.endTime}
• Video Call Link: ${generateGoogleMeetLink()}

Agenda:
${formattedAgenda || "1. Discussion and next steps"}

---
Scheduled via SlotIQ`;
}

export function generateInviteText(
  title: string,
  date: string,
  startTime: string,
  endTime: string,
  participants: string[],
  agendaItems: string[],
): string {
  return generateMeetInviteText({ title, date, startTime, endTime, participants, agenda: agendaItems });
}
