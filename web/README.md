# Scribeberry SDK — Web Example (Express + Vanilla JS)

A minimal Express server with a vanilla JavaScript frontend demonstrating the
[`@scribeberry/sdk`](https://www.npmjs.com/package/@scribeberry/sdk). No React,
no build step — just `npm install && npm start`.

Features:

- **Realtime transcription** — Record from your microphone with live speech-to-text
- **Template selection** — Choose a medical note template
- **AI note generation** — Generate structured clinical notes from the transcript
- **Zero build step** — The SDK is loaded from a CDN (`esm.sh`) in the browser

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up your API key

```bash
cp .env.example .env
```

Then edit `.env`:

```
SCRIBEBERRY_API_KEY=sk_test_your_key_here
```

Get your API key from [console.scribeberry.com](https://console.scribeberry.com).

### 3. Start the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

For development with auto-reload:

```bash
npm run dev
```

## How It Works

### Architecture

```
Browser (Vanilla JS)              Express Server                 Scribeberry API
────────────────────              ──────────────                 ───────────────

  app.js ──── GET /api/templates ──── sb.templates.list() ─── GET /templates

  app.js ──── POST /api/realtime-token ──── sb.realtime.createToken()
    │
    └── WebSocket (via SDK from CDN) ──────── Realtime transcription

  app.js ── POST /api/notes/generate ── sb.notes.generate() ── POST /notes
```

- **API key stays server-side** — The browser imports the SDK from a CDN for WebSocket streaming only, using temporary tokens
- **No build tools** — The frontend is plain HTML + JS served as static files
- **Server routes** use the SDK with a full API key for templates, notes, and token creation

### Key Files

| File | Description |
|------|-------------|
| `server.js` | Express server with API routes for templates, notes, and tokens |
| `public/index.html` | Single-page UI with embedded styles |
| `public/app.js` | Vanilla JS — mic access, AudioWorklet, SDK streaming, DOM updates |

## Learn More

- [SDK Documentation](https://console.scribeberry.com/docs)
- [npm Package](https://www.npmjs.com/package/@scribeberry/sdk)
- [Express Documentation](https://expressjs.com)

