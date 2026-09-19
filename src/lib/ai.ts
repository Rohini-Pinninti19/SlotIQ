import { Agenda, AiStatus, Constraints, Conflict, Slot } from "@/types/scheduling";
import { defaultConstraints, getRestoredDays, parseRequest, validateConstraints, classifyMeetingType } from "@/lib/scheduling";
import { generateAgenda } from "@/lib/agenda";
import { team } from "@/data/mockCalendarData";
import { logger } from "@/lib/logger";

const isOpenAIEnabled = () => process.env.AI_PROVIDER === "openai" && Boolean(process.env.OPENAI_API_KEY);
const model = process.env.OPENAI_MODEL?.includes(" ") ? "gpt-3.5-turbo" : (process.env.OPENAI_MODEL || "gpt-3.5-turbo");

async function complete(prompt: string): Promise<unknown> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a scheduling assistant. Return only valid JSON matching the requested schema. Never invent calendar availability — that is determined separately by a deterministic calendar engine." },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("AI provider unavailable");
  const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned no content");
  return JSON.parse(content);
}

export async function parseMeetingRequest(input: string): Promise<{ constraints: Constraints; aiStatus: AiStatus["parserUsed"] }> {
  const fallback = parseRequest(input);
  if (!isOpenAIEnabled()) return { constraints: fallback, aiStatus: "fallback" };
  try {
    const now = new Date().toISOString().slice(0, 10);
    const prompt = `Current date: ${now}. Timezone: Asia/Kolkata.
Team directory: ${team.map((m) => `${m.name} (${m.role})`).join(", ")}.
Parse this meeting request into JSON with these exact fields:
- duration: number (minutes)
- attendees: string[] (only names from team directory, never invent)
- preferredDays: string[] (e.g. ["Monday", "Tuesday"])
- preferredTimes: [{start: "HH:MM", end: "HH:MM"}] (24h format)
- excludedDays: string[]
- excludedTimes: [{start: "HH:MM", end: "HH:MM", reason: string}]
- excludedPeople: string[]
- meetingPurpose: string (concise title)
- location: string (room name, "Google Meet (online)", or "" if not mentioned)
- dateRange: {start: "YYYY-MM-DD", end: "YYYY-MM-DD"} (use 2026-09-21 to 2026-09-25 for next week)
- additionalNotes: string

Request: ${input}`;
    const parsed = await complete(prompt) as Partial<Constraints>;
    const restoredDays = getRestoredDays(input);
    const excludedDays = (parsed.excludedDays || []).filter((day) => !restoredDays.includes(day));
    return { constraints: validateConstraints({ ...defaultConstraints(), ...parsed, excludedDays, additionalNotes: parsed.additionalNotes || input }), aiStatus: "ai" };
  } catch (error) {
    logger.warn("AI parsing failed; using deterministic parser", { error: error instanceof Error ? error.message : String(error) });
    return { constraints: fallback, aiStatus: "fallback" };
  }
}

function buildPurposeSpecificAgendaPrompt(constraints: Constraints, slot: Slot, meetingType: string): string {
  const teamContext = constraints.attendees.map(name => {
    const m = team.find(t => t.name === name);
    return m ? `${m.name} (${m.role})` : name;
  }).join(", ");
  const locationContext = constraints.location ? `Location: ${constraints.location}.` : "";
  const typeInstructions: Record<string, string> = {
    "brainstorm": "Start with objective, then open idea generation phase, evaluation/voting, and close with selected ideas and owners.",
    "design-review": "Include design walkthrough, feedback round, decision recording, and action items.",
    "api-sync": "Cover API status, current blockers, integration issues, decisions needed, and next steps.",
    "standup": "Keep it tight: what was done, what's planned, blockers only.",
    "kickoff": "Include project overview, goals, roles/responsibilities, timeline, risks, and next steps.",
    "interview": "Include candidate intro, technical questions, culture fit discussion, and Q&A.",
    "planning": "Cover sprint goals, backlog review, estimates, capacity, and commitments.",
    "one-on-one": "Cover recent work, feedback, blockers, career/growth, and action items.",
    "sync": "Status updates, blockers, decisions, and action items.",
    "general": "Context setting, main discussion, decisions, and next steps.",
  };
  return `Generate a professional meeting agenda JSON for this meeting.
Meeting type: ${meetingType}. ${typeInstructions[meetingType] || ""}
Purpose: ${constraints.meetingPurpose}. Duration: ${constraints.duration} minutes.
Attendees: ${teamContext}. ${locationContext}
Additional notes: ${constraints.additionalNotes || "None"}.
Slot: ${slot.label}.

Return JSON with exactly these fields:
{
  "title": "concise professional title",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "items": [{"topic": "string", "duration": number, "description": "string"}],
  "preparationNotes": "what attendees should prepare",
  "meetingType": "${meetingType}"
}

IMPORTANT: item durations must sum to exactly ${constraints.duration}. Include 3-5 items. Be specific, not generic.`;
}

export async function generateMeetingAgenda(constraints: Constraints, slot: Slot): Promise<{ agenda: Agenda; aiStatus: AiStatus["agendaUsed"] }> {
  const meetingType = classifyMeetingType(constraints.meetingPurpose, constraints.additionalNotes || "");
  const fallback = generateAgenda(constraints, slot, meetingType);
  if (!isOpenAIEnabled()) return { agenda: fallback, aiStatus: "fallback" };
  try {
    const generated = await complete(buildPurposeSpecificAgendaPrompt(constraints, slot, meetingType)) as Agenda;
    if (!generated.title || !Array.isArray(generated.items) || generated.items.length < 3 || generated.items.reduce((sum, item) => sum + Number(item.duration), 0) !== constraints.duration) {
      return { agenda: fallback, aiStatus: "fallback" };
    }
    return { agenda: { ...generated, meetingType }, aiStatus: "ai" };
  } catch (error) {
    logger.warn("AI agenda generation failed; using deterministic agenda", { error: error instanceof Error ? error.message : String(error) });
    return { agenda: fallback, aiStatus: "fallback" };
  }
}

export async function explainConflict(slot: Slot, constraints: Constraints): Promise<{ tradeoffExplanation: string; suggestedResolution: string; aiStatus: AiStatus["conflictExplanationUsed"] }> {
  const available = slot.available.join(", ");
  const conflicts = slot.conflicts.map((conflict: Conflict) => {
    const member = team.find(m => m.name === conflict.attendee);
    const role = member?.role || conflict.event.role || "team member";
    return `${conflict.attendee} (${role}): "${conflict.event.title}" ${conflict.event.start}–${conflict.event.end}, overlap ${conflict.duration}m`;
  }).join("; ");
  const fallback = {
    tradeoffExplanation: slot.conflicts.length === 0
      ? `${slot.label} is a clear window with all ${constraints.attendees.length} attendees available.`
      : `${slot.label} works for ${slot.available.length} of ${constraints.attendees.length} attendees. ${conflicts ? `Conflict: ${conflicts}.` : ""}`,
    suggestedResolution: conflicts
      ? `Consider moving the conflicting event or choosing a clear window to include all attendees.`
      : "No resolution needed — everyone is available.",
    aiStatus: "fallback" as const,
  };
  if (!isOpenAIEnabled()) return fallback;
  try {
    const result = await complete(`Explain this scheduling trade-off for a hackathon demo in exactly two JSON string fields: "tradeoffExplanation" and "suggestedResolution".
Meeting: ${constraints.meetingPurpose}. Slot: ${slot.label}. Duration: ${constraints.duration} min.
Available: ${available || "none"}. Conflicts: ${conflicts || "none"}.
Be factual, specific, and mention exact times and roles. Suggest a concrete alternative if there are conflicts.`) as { tradeoffExplanation: string; suggestedResolution: string };
    return { ...result, aiStatus: "ai" as const };
  } catch (error) {
    logger.warn("AI conflict explanation failed; using deterministic explanation", { error: error instanceof Error ? error.message : String(error) });
    return fallback;
  }
}
