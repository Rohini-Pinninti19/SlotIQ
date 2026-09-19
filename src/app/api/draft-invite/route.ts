import { NextResponse } from "next/server";
import { draftInvite } from "@/lib/agenda";

export async function POST(request: Request) {
  try {
    const { constraints, slot, agenda } = await request.json();
    return NextResponse.json({ invite: draftInvite(constraints, slot, agenda) });
  } catch {
    return NextResponse.json({ error: "Invite drafting failed." }, { status: 400 });
  }
}