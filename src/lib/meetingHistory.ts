import { promises as fs } from "node:fs";
import path from "node:path";
import { MeetingRecord } from "@/types/history";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabaseAdmin";

const historyFile = () => process.env.MEETING_HISTORY_FILE || path.join(process.cwd(), "data", "meeting-history.json");
type MeetingRow = {
  id: string;
  created_at: string;
  title: string;
  date: string;
  attendees: string[];
  status: MeetingRecord["status"];
  fit_score: number;
  conflict_count: number;
  attendee_conflict_counts: Record<string, number>;
  constraints: MeetingRecord["constraints"];
  slot: MeetingRecord["slot"];
  agenda: MeetingRecord["agenda"] | null;
};

async function readRecords(): Promise<MeetingRecord[]> {
  try {
    const contents = await fs.readFile(/* turbopackIgnore: true */ historyFile(), "utf8");
    const parsed: unknown = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed as MeetingRecord[] : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function listMeetingRecords(): Promise<MeetingRecord[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin()
      .from("meeting_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`Supabase history query failed: ${error.message}`);
    return (data as MeetingRow[]).map(toMeetingRecord);
  }
  return (await readRecords()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveMeetingRecord(record: MeetingRecord): Promise<MeetingRecord> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseAdmin().from("meeting_history").upsert({
      id: record.id,
      created_at: record.createdAt,
      title: record.title,
      date: record.date,
      attendees: record.attendees,
      status: record.status,
      fit_score: record.fitScore,
      conflict_count: record.conflictCount,
      attendee_conflict_counts: record.attendeeConflictCounts,
      constraints: record.constraints,
      slot: record.slot,
      agenda: record.agenda || null,
    });
    if (error) throw new Error(`Supabase history write failed: ${error.message}`);
    return record;
  }
  const records = await readRecords();
  records.unshift(record);
  const file = historyFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(/* turbopackIgnore: true */ file, JSON.stringify(records.slice(0, 100), null, 2), "utf8");
  return record;
}

function toMeetingRecord(row: MeetingRow): MeetingRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    date: row.date,
    attendees: row.attendees,
    status: row.status,
    fitScore: row.fit_score,
    conflictCount: row.conflict_count,
    attendeeConflictCounts: row.attendee_conflict_counts || {},
    constraints: row.constraints,
    slot: row.slot,
    agenda: row.agenda || undefined,
  };
}
