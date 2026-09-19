import { NextResponse } from "next/server";
import { findSlots, validateConstraints } from "@/lib/scheduling";

export async function POST(request: Request) {
  try { const constraints = validateConstraints(await request.json()); return NextResponse.json({ slots: findSlots(constraints) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "I couldn't analyze availability right now." }, { status: 400 }); }
}