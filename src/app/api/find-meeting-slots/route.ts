import { NextResponse } from "next/server";
import { findSlots, validateConstraints } from "@/lib/scheduling";
import { logger } from "@/lib/logger";
import { constraintsSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = constraintsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid scheduling constraints." }, { status: 400 });
    const constraints = validateConstraints(parsed.data);
    return NextResponse.json({ slots: findSlots(constraints) });
  }
  catch (error) {
    logger.warn("Slot search rejected", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "I couldn't analyze availability right now." }, { status: 400 });
  }
}