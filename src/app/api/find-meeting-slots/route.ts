import { NextResponse } from "next/server";
import { findSlots, validateConstraints } from "@/lib/scheduling";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try { const constraints = validateConstraints(await request.json()); return NextResponse.json({ slots: findSlots(constraints) }); }
  catch (error) {
    logger.warn("Slot search rejected", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "I couldn't analyze availability right now." }, { status: 400 });
  }
}