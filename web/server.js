import "dotenv/config";
import express from "express";
import { Scribeberry } from "@scribeberry/sdk";

// ── Validate configuration ─────────────────────────────────────────────

const API_KEY = process.env.SCRIBEBERRY_API_KEY;
const BASE_URL = process.env.SCRIBEBERRY_BASE_URL;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error(
    "\n  ✗ SCRIBEBERRY_API_KEY is not set.\n" +
      "    Copy .env.example to .env and add your key:\n\n" +
      "      cp .env.example .env\n\n"
  );
  process.exit(1);
}

// ── Initialize SDK and Express ─────────────────────────────────────────

const sb = new Scribeberry({ apiKey: API_KEY, baseUrl: BASE_URL });
const app = express();

app.use(express.json());
app.use(express.static("public"));

// ── API Routes ─────────────────────────────────────────────────────────

/** List available note templates. */
app.get("/api/templates", async (_req, res) => {
  try {
    const templates = await sb.templates.list({ pageSize: 50 });
    res.json(templates);
  } catch (err) {
    console.error("Failed to list templates:", err);
    res.status(500).json({ error: "Failed to load templates" });
  }
});

/** Create a temporary realtime token for the browser. */
app.post("/api/realtime-token", async (_req, res) => {
  try {
    const token = await sb.realtime.createToken({ expiresInSeconds: 3600 });
    res.json(token);
  } catch (err) {
    console.error("Failed to create token:", err);
    res.status(500).json({ error: "Failed to create realtime token" });
  }
});

/** Generate a note from transcript text and a template. */
app.post("/api/notes/generate", async (req, res) => {
  try {
    const { templateId, conversationText } = req.body;

    if (!templateId || !conversationText) {
      return res
        .status(400)
        .json({ error: "templateId and conversationText are required" });
    }

    const result = await sb.notes.generate({ templateId, conversationText });
    res.json(result);
  } catch (err) {
    console.error("Failed to generate note:", err);
    const message = err?.message || "Failed to generate note";
    const status = err?.status || 500;
    res.status(status).json({ error: message });
  }
});

// ── Start ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Scribeberry Express Example`);
  console.log(`  ──────────────────────────`);
  console.log(`  ✓ Running at http://localhost:${PORT}`);
  console.log(`  ✓ API key:   ${API_KEY.slice(0, 12)}...`);
  if (BASE_URL) console.log(`  ✓ Base URL:  ${BASE_URL}`);
  console.log();
});

