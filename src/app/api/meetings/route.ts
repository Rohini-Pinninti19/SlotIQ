import { NextResponse } from "next/server";
import { listMeetingRecords, saveMeetingRecord } from "@/lib/meetingHistory";
import { logger } from "@/lib/logger";
import { MeetingRecord } from "@/types/history";

export async function GET() {
  try {
    return NextResponse.json({ meetings: await listMeetingRecords() });
  } catch (error) {
    logger.error("Failed to read meeting history", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Meeting history is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const record = await request.json() as MeetingRecord;
    if (!record.id || !record.title || !record.slot?.date || !Array.isArray(record.attendees)) {
      return NextResponse.json({ error: "A meeting record with title, date, slot, and attendees is required." }, { status: 400 });
    }
    return NextResponse.json({ meeting: await saveMeetingRecord(record) }, { status: 201 });
  } catch (error) {
    logger.error("Failed to save meeting history", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Meeting history could not be saved." }, { status: 503 });
  }
}
