import { NextResponse } from "next/server";

/**
 * Returns whether the app is configured — without exposing any secret values.
 * The client uses this to decide whether to show the setup guide or the main UI.
 */
export async function GET() {
  const hasApiKey = !!process.env.SCRIBEBERRY_API_KEY;
  const environment = process.env.SCRIBEBERRY_BASE_URL?.includes("sandbox")
    ? "sandbox"
    : "production";

  return NextResponse.json({
    configured: hasApiKey,
    environment: hasApiKey ? environment : null,
  });
}

