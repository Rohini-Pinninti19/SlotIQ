import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const tokenCookie = request.headers.get("cookie")?.match(/(?:^|;\s*)slotiq_google_tokens=([^;]+)/)?.[1];
  if (!tokenCookie) return NextResponse.json({ connected: false });
  try {
    const tokens = JSON.parse(decodeURIComponent(tokenCookie));
    if (!tokens?.access_token) return NextResponse.json({ connected: false });
    return NextResponse.json({ connected: true });
  } catch { return NextResponse.json({ connected: false }); }
}
