import { NextResponse } from "next/server";
import { team } from "@/data/mockCalendarData";

export async function GET() {
  return NextResponse.json({ attendees: team });
}
