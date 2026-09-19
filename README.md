This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
# SlotIQ

### Seamless Scheduling, Smarter Meetings

SlotIQ turns a conversational meeting request into a ranked, explainable set of meeting windows. It parses natural-language constraints, checks multiple mock calendars, resolves conflicts with trade-offs, and drafts an agenda and invite.

## What is included

- Natural-language constraint extraction with a deterministic fallback parser
- Editable constraint review before scheduling
- Six realistic mock teammate calendars with intentional conflicts
- Deterministic candidate generation, availability checks, preference scoring, severity, and fairness
- Top five ranked recommendations with transparent fit scores
- Conflict details and suggested resolutions
- Explore Trade-offs actions for relaxing time/day preferences
- Agenda generation with time allocations that sum to the meeting duration
- Invite preview and Copy Invite clipboard export
- Email-style invite draft with a generated Google Meet-style room link
- REST API routes ready for a future LLM provider or real calendar adapter

This hackathon MVP uses mock calendar data. No Google Calendar or Outlook connection is required.

## Architecture

```text
Natural-language request
	|
	v
Constraint parser (server route + deterministic fallback)
	|
	v
Validated constraints -> scheduling engine -> availability + scoring
	|
	v
Ranked slots -> conflict details -> agenda -> invite draft
```

The LLM is intentionally kept out of the time-selection decision. A future provider can be added behind the parser and agenda route without changing the scheduling engine.

## Tech stack

- Next.js App Router, React, TypeScript
- Tailwind CSS v4 and custom CSS tokens
- Lucide React icons
- In-memory mock calendar data
- REST-style Next.js route handlers

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production validation:

```bash
npm run lint
npm run build
```

## API routes

- `POST /api/parse-meeting-request`
- `POST /api/find-meeting-slots`
- `POST /api/generate-agenda`
- `POST /api/draft-invite`
- `POST /api/explain-conflict`
- `GET /api/attendees`
- `GET /api/calendar`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/google/create-event`

For real Google Meet creation, configure Google Calendar API OAuth with server-side credentials and request `https://www.googleapis.com/auth/calendar.events`. Open `/api/auth/google`, approve access, then select a slot. SlotIQ creates a Calendar event with `conferenceData` and uses Google's returned Meet URL. Credentials stay server-side in `.env.local`; never commit or expose them.

## Demo flow

1. Use the default Q4 design review request or choose one of the three demo prompts.
2. Review the extracted duration, attendees, date range, and preferences.
3. Find slots and inspect the ranked results.
4. Open `Why this slot?` on a partial-conflict result to see the attendee event and resolution suggestion.
5. Use `Explore trade-offs` to relax a preference and recalculate.
6. Select a slot, review the generated agenda, then copy the invite.

## Future enhancements

Add an LLM provider adapter for richer extraction and explanations, persist historical fairness signals, connect Google Calendar or Microsoft Graph, and add true smart rescheduling with attendee negotiation.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
