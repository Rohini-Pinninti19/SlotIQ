import { z } from "zod";

const timeRangeSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().optional(),
});

export const constraintsSchema = z.object({
  duration: z.number().int().min(5).max(480),
  attendees: z.array(z.string()).min(1),
  preferredDays: z.array(z.string()),
  preferredTimes: z.array(timeRangeSchema),
  excludedDays: z.array(z.string()),
  excludedTimes: z.array(timeRangeSchema),
  excludedPeople: z.array(z.string()).default([]),
  meetingPurpose: z.string().min(1),
  location: z.string(),
  dateRange: z.object({ start: z.string().date(), end: z.string().date() }),
  additionalNotes: z.string(),
  timezone: z.string().optional(),
  workingHours: z.object({ start: z.string(), end: z.string() }).optional(),
});

export const parseRequestSchema = z.object({
  input: z.string().trim().min(1).max(4000),
  timezone: z.string().max(100).optional(),
  clarificationState: z.object({
    baseInput: z.string(),
    step: z.enum(["duration", "attendees"]),
  }).optional(),
});

export const slotRequestSchema = z.object({
  constraints: constraintsSchema,
  slot: z.object({
    date: z.string().date(),
    start: z.string(),
    end: z.string(),
  }).passthrough(),
});
