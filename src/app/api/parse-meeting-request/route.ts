import { NextResponse } from "next/server";
import { parseMeetingRequest } from "@/lib/ai";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.input?.trim()) return NextResponse.json({ error: "Please describe the meeting you want to schedule." }, { status: 400 });
    const { constraints, aiStatus } = await parseMeetingRequest(body.input);
    return NextResponse.json({ constraints, aiStatus });
  } catch (error) {
    logger.warn("Meeting request parsing rejected", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "I couldn't understand that request. Try including a duration and attendee names." }, { status: 400 });
  }
}