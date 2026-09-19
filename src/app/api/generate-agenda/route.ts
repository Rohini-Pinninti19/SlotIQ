import { NextResponse } from "next/server";
import { draftInvite } from "@/lib/agenda";
import { generateMeetingAgenda } from "@/lib/ai";
import { createGoogleMeeting, updateGoogleEventDescription } from "@/lib/google";
import { getMember } from "@/data/mockCalendarData";

export async function POST(request: Request) {
  try {
    const { constraints, slot } = await request.json();
    const { agenda, aiStatus: agendaAiStatus } = await generateMeetingAgenda(constraints, slot);
    const invite = draftInvite(constraints, slot, agenda);

    const tokenCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)slotiq_google_tokens=([^;]+)/)?.[1];
    if (tokenCookie) {
      try {
        const tokens = JSON.parse(decodeURIComponent(tokenCookie));
        const googleEvent = await createGoogleMeeting(tokens, {
          title: agenda.title,
          description: invite.body.replace("MEET_LINK_PLACEHOLDER", "TBD"),
          start: `${slot.date}T${slot.start}:00`,
          end: `${slot.date}T${slot.end}:00`,
          timezone: process.env.GOOGLE_TIMEZONE || "Asia/Kolkata",
          attendees: constraints.attendees.map((name: string) => getMember(name)?.email).filter(Boolean),
        });
        if (googleEvent.meetLink) {
          const realMeetLink = googleEvent.meetLink;
          invite.meetLink = realMeetLink;
          invite.googleEventId = googleEvent.eventId || undefined;
          invite.googleStatus = "created";
          invite.googleEventUrl = googleEvent.eventId
            ? `https://calendar.google.com/calendar/event?eid=${googleEvent.eventId}`
            : undefined;
          invite.body = invite.body.replace("MEET_LINK_PLACEHOLDER", realMeetLink);
          if (googleEvent.eventId) {
            await updateGoogleEventDescription(tokens, googleEvent.eventId, invite.body);
          }
        } else {
          invite.googleStatus = "failed";
          invite.googleError = "Google Calendar created the event but did not return a Google Meet link. The invite remains a draft.";
          invite.body = invite.body.replace("MEET_LINK_PLACEHOLDER", "https://meet.google.com/new");
        }
      } catch (googleErr) {
        invite.googleStatus = "failed";
        invite.googleError = googleErr instanceof Error ? googleErr.message : "Google Calendar could not create the event. The invite remains a draft.";
        invite.body = invite.body.replace("MEET_LINK_PLACEHOLDER", "https://meet.google.com/new");
      }
    } else {
      // Demo mode — no OAuth token
      invite.googleStatus = "not_connected";
      invite.body = invite.body.replace("MEET_LINK_PLACEHOLDER", "https://meet.google.com/new");
    }

    return NextResponse.json({ agenda, invite, agendaAiStatus });
  } catch { return NextResponse.json({ error: "Agenda generation failed." }, { status: 400 }); }
}