import { Scribeberry, ScribeberryError } from "@scribeberry/sdk";
import { NextRequest, NextResponse } from "next/server";

const sb = new Scribeberry({
  apiKey: process.env.SCRIBEBERRY_API_KEY!,
  baseUrl: process.env.SCRIBEBERRY_BASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, conversationText } = body;

    if (!templateId || !conversationText) {
      return NextResponse.json(
        { error: "templateId and conversationText are required" },
        { status: 400 }
      );
    }

    const result = await sb.notes.generate({ templateId, conversationText });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to generate note:", error);

    // Pass through the SDK error message so the UI can show something useful
    const message =
      error instanceof ScribeberryError
        ? error.message
        : "Failed to generate note";
    const status = error instanceof ScribeberryError ? error.status ?? 500 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
