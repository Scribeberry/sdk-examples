# Scribeberry SDK — Next.js Example

A minimal Next.js app demonstrating the [`@scribeberry/sdk`](https://www.npmjs.com/package/@scribeberry/sdk) for:

- **Realtime transcription** — Record from your microphone with live speech-to-text via `useTranscription` from `@scribeberry/sdk/react`
- **Template selection** — Choose a medical note template (SOAP, H&P, etc.)
- **AI note generation** — Generate structured clinical notes from the transcript

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your API key

Copy the example env file and add your Scribeberry API key:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
SCRIBEBERRY_API_KEY=sk_test_your_key_here
```

Get your API key from [console.scribeberry.com](https://console.scribeberry.com).

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### Architecture

```
Browser                          Next.js Server                 Scribeberry API
──────                           ──────────────                 ───────────────

  page.tsx ──── GET /api/templates ──── sb.templates.list() ─── GET /templates

  useTranscription() ── POST /api/realtime-token ── sb.realtime.createToken()
       │                    (from @scribeberry/sdk/react)
       └── WebSocket ──────────────────────────────── Realtime transcription

  page.tsx ── POST /api/notes/generate ── sb.notes.generate() ── POST /notes
```

- **API key stays server-side** — The browser never sees your `sk_test_*` / `sk_live_*` key
- **Realtime uses temporary tokens** — `useTranscription` fetches a short-lived `sb_rt_*` token via your API route
- **All SDK calls go through API routes** — Clean separation of server and client concerns

### Key Files

| File | Description |
|------|-------------|
| `app/page.tsx` | Main UI — template picker, transcription, note display |
| `app/api/templates/route.ts` | Lists available templates |
| `app/api/notes/generate/route.ts` | Generates a note from transcript + template |
| `app/api/realtime-token/route.ts` | Creates a temporary token for browser WebSocket access |
| `app/api/status/route.ts` | Config check — shows setup guide if API key is missing |

## Learn More

- [SDK Documentation](https://console.scribeberry.com/docs)
- [npm Package](https://www.npmjs.com/package/@scribeberry/sdk)
- [Next.js Documentation](https://nextjs.org/docs)
