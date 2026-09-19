import { promises as fs } from "node:fs";
import path from "node:path";
import { MeetingRecord } from "@/types/history";

const historyFile = () => process.env.MEETING_HISTORY_FILE || path.join(process.cwd(), "data", "meeting-history.json");

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
  return (await readRecords()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveMeetingRecord(record: MeetingRecord): Promise<MeetingRecord> {
  const records = await readRecords();
  records.unshift(record);
  const file = historyFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(/* turbopackIgnore: true */ file, JSON.stringify(records.slice(0, 100), null, 2), "utf8");
  return record;
}
