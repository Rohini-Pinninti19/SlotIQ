import { NextResponse } from "next/server";
import { explainConflict } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { validateConstraints, validateSlot } from "@/lib/scheduling";

export async function POST(request: Request) {
  try {
    const { slot, constraints } = await request.json();
    const result = await explainConflict(validateSlot(slot), validateConstraints(constraints));
    return NextResponse.json(result);
  } catch (error) {
    logger.warn("Conflict explanation request failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Conflict explanation failed." }, { status: 400 });
  }
}