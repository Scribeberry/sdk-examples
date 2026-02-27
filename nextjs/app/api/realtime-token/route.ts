import { Scribeberry } from "@scribeberry/sdk";
import { NextResponse } from "next/server";

const sb = new Scribeberry({
  apiKey: process.env.SCRIBEBERRY_API_KEY!,
  baseUrl: process.env.SCRIBEBERRY_BASE_URL,
});

export async function POST() {
  try {
    const token = await sb.realtime.createToken({ expiresInSeconds: 3600 });
    return NextResponse.json(token);
  } catch (error) {
    console.error("Failed to create realtime token:", error);
    return NextResponse.json(
      { error: "Failed to create realtime token" },
      { status: 500 }
    );
  }
}

