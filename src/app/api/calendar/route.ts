import { NextResponse } from "next/server";
import { calendar, getWeekDates } from "@/data/mockCalendarData";

export async function GET() {
  return NextResponse.json({ week: getWeekDates(), events: calendar });
}
