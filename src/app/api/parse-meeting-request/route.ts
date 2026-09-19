import { NextResponse } from "next/server";
import { parseMeetingRequest } from "@/lib/ai";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.input?.trim()) return NextResponse.json({ error: "Please describe the meeting you want to schedule." }, { status: 400 });
    const input = String(body.input);
    const hasDuration = /\b\d+\s*-?\s*(?:minute|min|hour|hr)s?\b/i.test(input);
    const hasAttendee = /\b(?:alice|bob|carol|dave|eve|frank|with|attendees?)\b/i.test(input);
    if (!hasDuration || !hasAttendee) {
      const missing = [!hasDuration ? "the meeting duration (for example, 30 minutes)" : "", !hasAttendee ? "the attendee names (for example, Alice and Bob)" : ""]
        .filter(Boolean)
        .join(" and ");
      return NextResponse.json({
        needsClarification: true,
        clarification: `Please include ${missing}.`,
      });
    }
    const { constraints, aiStatus } = await parseMeetingRequest(input);
    return NextResponse.json({ constraints, aiStatus });
  } catch (error) {
    logger.warn("Meeting request parsing rejected", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "I couldn't understand that request. Try including a duration and attendee names." }, { status: 400 });
  }
}