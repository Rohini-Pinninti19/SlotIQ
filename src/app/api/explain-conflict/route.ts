import { NextResponse } from "next/server";
import { explainConflict } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const { slot, constraints } = await request.json();
    const result = await explainConflict(slot, constraints);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Conflict explanation failed." }, { status: 400 });
  }
}