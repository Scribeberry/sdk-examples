# Scribeberry SDK Examples

Example applications demonstrating the [`@scribeberry/sdk`](https://www.npmjs.com/package/@scribeberry/sdk) — medical transcription, AI note generation, and realtime speech-to-text.

## Examples

| Example | Stack | Description |
| --- | --- | --- |
| [nextjs](./nextjs) | Next.js 16 · React 19 · Tailwind CSS 4 | Uses `useTranscription` from `@scribeberry/sdk/react` |
| [web](./web) | Express 5 · Vanilla JS | No framework, no build step — SDK loaded from CDN |

## Getting Started

Each example is a standalone project. Navigate into the example directory and follow its README:

```bash
# React example
cd nextjs
npm install
cp .env.example .env.local
npm run dev

# Vanilla JS example
cd web
npm install
cp .env.example .env
npm start
```

You'll need a Scribeberry API key — sign up at [console.scribeberry.com](https://console.scribeberry.com).

## Links

- [SDK Documentation](https://console.scribeberry.com/docs)
- [npm Package](https://www.npmjs.com/package/@scribeberry/sdk)
- [Report Issues](https://github.com/Scribeberry/sdk-examples/issues)
