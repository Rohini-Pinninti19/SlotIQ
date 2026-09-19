import { NextResponse } from "next/server";
import { parseMeetingRequest } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { ClarificationState, nextClarification } from "@/lib/clarification";
import { parseRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const parsedBody = parseRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) return NextResponse.json({ error: "Please provide a valid meeting request." }, { status: 400 });
    const body = parsedBody.data;
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