import { NextResponse } from "next/server";
import { parseMeetingRequest } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { ClarificationState, nextClarification } from "@/lib/clarification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.input?.trim()) return NextResponse.json({ error: "Please describe the meeting you want to schedule." }, { status: 400 });
    const input = String(body.input);
    const clarification = nextClarification(input, body.clarificationState as ClarificationState | undefined);
    if (clarification) return NextResponse.json({ needsClarification: true, clarification: clarification.question, clarificationState: clarification.state });
    const fullInput = body.clarificationState ? `${body.clarificationState.baseInput} ${input}` : input;
    const { constraints, aiStatus } = await parseMeetingRequest(fullInput);
    const timezone = typeof body.timezone === "string" && body.timezone.length <= 64 ? body.timezone : undefined;
    return NextResponse.json({ constraints: timezone ? { ...constraints, timezone } : constraints, aiStatus });
  } catch (error) {
    logger.warn("Meeting request parsing rejected", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "I couldn't understand that request. Try including a duration and attendee names." }, { status: 400 });
  }
}