import { Scribeberry } from "@scribeberry/sdk";
import { NextResponse } from "next/server";

const sb = new Scribeberry({
  apiKey: process.env.SCRIBEBERRY_API_KEY!,
  baseUrl: process.env.SCRIBEBERRY_BASE_URL,
});

export async function GET() {
  try {
    const templates = await sb.templates.list({ pageSize: 50 });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to list templates:", error);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

