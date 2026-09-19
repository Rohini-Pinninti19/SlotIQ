import { google } from "googleapis";

const scopes = ["https://www.googleapis.com/auth/calendar.events"];

export function googleOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) throw new Error("Google Calendar OAuth is not configured.");
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

export function googleAuthUrl(state: string) {
  return googleOAuthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: scopes, state });
}

export async function exchangeGoogleCode(code: string) {
  const client = googleOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function createGoogleMeeting(tokens: { access_token?: string | null; refresh_token?: string | null }, details: { title: string; description: string; start: string; end: string; attendees: string[]; timezone: string }) {
  const client = googleOAuthClient();
  client.setCredentials(tokens);
  const calendar = google.calendar({ version: "v3", auth: client });
  const response = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: details.title,
      description: details.description,
      start: { dateTime: details.start, timeZone: details.timezone },
      end: { dateTime: details.end, timeZone: details.timezone },
      attendees: details.attendees.map((email) => ({ email })),
      conferenceData: { createRequest: { requestId: `slotiq-${crypto.randomUUID()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    },
  });
  const eventId = response.data.id;
  let event = response.data;
  for (let attempt = 0; attempt < 5 && eventId; attempt += 1) {
    const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri;
    if (meetLink) return { eventId, meetLink };
    await new Promise((resolve) => setTimeout(resolve, 500));
    event = (await calendar.events.get({
      calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
      eventId,
    })).data;
  }
  return {
    eventId,
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri,
  };
}

export async function updateGoogleEventDescription(
  tokens: { access_token?: string | null; refresh_token?: string | null },
  eventId: string,
  description: string,
) {
  const client = googleOAuthClient();
  client.setCredentials(tokens);
  const calendar = google.calendar({ version: "v3", auth: client });
  await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID || "primary",
    eventId,
    requestBody: { description },
  });
}
