import { NextResponse } from "next/server";
import { draftInvite } from "@/lib/agenda";
import { generateMeetingAgenda } from "@/lib/ai";
import { createGoogleMeeting, updateGoogleEventDescription } from "@/lib/google";
import { getMember } from "@/data/mockCalendarData";
import { logger } from "@/lib/logger";
import { validateConstraints, validateSlot } from "@/lib/scheduling";

export async function POST(request: Request) {
  try {
    const { constraints: rawConstraints, slot: rawSlot } = await request.json();
    const constraints = validateConstraints(rawConstraints);
    const slot = validateSlot(rawSlot);
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
          attendees: constraints.attendees
            .map((name) => getMember(name)?.email)
            .filter((email): email is string => Boolean(email)),
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
        logger.warn("Google event creation failed; returning draft invite", { error: googleErr instanceof Error ? googleErr.message : String(googleErr) });
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
  } catch (error) {
    logger.warn("Agenda generation request failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Agenda generation failed." }, { status: 400 });
  }
}