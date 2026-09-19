import { NextResponse } from "next/server";
import { googleAuthUrl } from "@/lib/google";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const state = crypto.randomUUID();
    const response = NextResponse.redirect(googleAuthUrl(state));
    response.cookies.set("slotiq_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
    return response;
  } catch (error) {
    logger.error("Google OAuth initialization failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Google Calendar is not configured." }, { status: 503 });
  }
}
