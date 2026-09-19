import { NextResponse } from "next/server";
import { draftInvite } from "@/lib/agenda";
import { logger } from "@/lib/logger";
import { validateConstraints, validateSlot } from "@/lib/scheduling";

export async function POST(request: Request) {
  try {
    const { constraints, slot, agenda } = await request.json();
    return NextResponse.json({ invite: draftInvite(validateConstraints(constraints), validateSlot(slot), agenda) });
  } catch (error) {
    logger.warn("Invite draft request failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Invite drafting failed." }, { status: 400 });
  }
}