import { NextResponse } from "next/server";
import { createGoogleMeeting } from "@/lib/google";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)slotiq_google_tokens=([^;]+)/)?.[1];
    if (!cookie) return NextResponse.json({ error: "Connect Google Calendar before creating a Meet room." }, { status: 401 });
    const tokens = JSON.parse(decodeURIComponent(cookie));
    const details = await request.json();
    const result = await createGoogleMeeting(tokens, details);
    if (!result.meetLink) return NextResponse.json({ error: "Google Calendar created the event but did not return a Meet link." }, { status: 502 });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Google Calendar event creation failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Google Calendar could not create the meeting. Check OAuth permissions and attendee emails." }, { status: 502 });
  }
}
