import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/(?:^|;\s*)slotiq_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || state !== cookieState) return NextResponse.json({ error: "Google OAuth state validation failed." }, { status: 400 });
  try {
    const tokens = await exchangeGoogleCode(code);
    const response = NextResponse.redirect(new URL("/?google=connected&view=calendars", request.url));
    response.cookies.set("slotiq_google_tokens", JSON.stringify(tokens), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
    response.cookies.delete("slotiq_oauth_state");
    return response;
  } catch { return NextResponse.redirect(new URL("/?google=error", request.url)); }
}
