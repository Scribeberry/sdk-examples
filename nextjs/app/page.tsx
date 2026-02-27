"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranscription } from "@scribeberry/sdk/react";
import type { Template, GenerateNoteResult } from "@scribeberry/sdk";

export default function Home() {
  // ── Configuration check ─────────────────────────────────────────────
  const [configStatus, setConfigStatus] = useState<{
    configured: boolean;
    environment: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then(setConfigStatus)
      .catch(() => setConfigStatus({ configured: false, environment: null }));
  }, []);

  // ── Template selection ──────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
    if (!configStatus?.configured) return;
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.items ?? []);
        if (data.items?.length > 0) {
          setSelectedTemplateId(data.items[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTemplates(false));
  }, [configStatus?.configured]);

  // ── Realtime transcription ──────────────────────────────────────────
  const transcription = useTranscription({
    getRealtimeToken: async () => {
      const res = await fetch("/api/realtime-token", { method: "POST" });
      if (!res.ok) throw new Error("Failed to get realtime token");
      return res.json();
    },
  });

  // ── Note generation ─────────────────────────────────────────────────
  const [noteResult, setNoteResult] = useState<GenerateNoteResult | null>(null);
  const [generatingNote, setGeneratingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const generateNote = useCallback(async () => {
    if (!selectedTemplateId || !transcription.transcript) return;

    setGeneratingNote(true);
    setNoteError(null);

    try {
      const res = await fetch("/api/notes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          conversationText: transcription.transcript,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate note");
      setNoteResult(data);
    } catch (err) {
      setNoteError(
        err instanceof Error ? err.message : "Failed to generate note"
      );
    } finally {
      setGeneratingNote(false);
    }
  }, [selectedTemplateId, transcription.transcript]);

  // ── Derived state ───────────────────────────────────────────────────
  const isRecording = transcription.status === "recording";
  const isConnecting = transcription.status === "connecting";
  const hasTranscript = transcription.transcript.length > 0;
  const canGenerate =
    hasTranscript && selectedTemplateId && !generatingNote && !isRecording;

  const isLoading = configStatus === null;
  const isConfigured = configStatus?.configured === true;

  return (
    <div className="min-h-screen font-sans">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-white">
              S
            </div>
            <h1 className="text-lg font-semibold text-zinc-100">
              Scribeberry SDK Demo
            </h1>
          </div>
          <a
            href="https://www.npmjs.com/package/@scribeberry/sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            @scribeberry/sdk
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {isLoading ? (
          /* ── Loading skeleton ─────────────────────────────────────── */
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-10 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-32 animate-pulse rounded-lg bg-white/[0.05]" />
          </div>
        ) : !isConfigured ? (
          /* ── Setup guide ──────────────────────────────────────────── */
          <SetupGuide />
        ) : (
          /* ── Main app ─────────────────────────────────────────────── */
          <>
            {/* Step 1: Choose Template */}
            <Section number={1} title="Choose a template">
              <p className="mb-3 text-sm text-zinc-500">
                Templates define the structure of the generated note (e.g. SOAP,
                H&P, Progress Note).
              </p>
              {loadingTemplates ? (
                <div className="h-10 animate-pulse rounded-lg bg-white/[0.05]" />
              ) : templates.length === 0 ? (
                <p className="text-sm text-amber-400">
                  No templates found. Create one in your Scribeberry dashboard.
                </p>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-sm text-zinc-200 shadow-sm transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id} className="bg-zinc-900">
                      {t.name}
                      {t.description ? ` — ${t.description}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Section>

            {/* Step 2: Record */}
            <Section number={2} title="Record a conversation">
              <p className="mb-4 text-sm text-zinc-500">
                Click record and speak into your microphone. The transcript
                updates in real-time.
              </p>

              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={
                    isRecording ? transcription.stop : transcription.start
                  }
                  disabled={isConnecting}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isRecording
                      ? "bg-red-600 hover:bg-red-500 focus:ring-red-500"
                      : "bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500"
                  }`}
                >
                  {isConnecting ? (
                    <Spinner />
                  ) : isRecording ? (
                    <PulsingDot />
                  ) : (
                    <MicIcon />
                  )}
                  {isConnecting
                    ? "Connecting…"
                    : isRecording
                      ? "Stop Recording"
                      : "Start Recording"}
                </button>

                {hasTranscript && !isRecording && (
                  <button
                    onClick={() => {
                      transcription.clear();
                      setNoteResult(null);
                      setNoteError(null);
                    }}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                  >
                    Clear
                  </button>
                )}

                {transcription.durationSeconds !== null && (
                  <span className="text-xs text-zinc-500">
                    {formatDuration(transcription.durationSeconds)}
                  </span>
                )}
              </div>

              <div
                className={`min-h-[120px] rounded-lg border p-4 text-sm leading-relaxed transition-colors ${
                  isRecording
                    ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                {hasTranscript || transcription.partial ? (
                  <>
                    <span className="text-zinc-200">
                      {transcription.transcript}
                    </span>
                    {transcription.partial && (
                      <span className="text-zinc-500">
                        {transcription.transcript ? " " : ""}
                        {transcription.partial}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-600">
                    {isRecording
                      ? "Listening…"
                      : "Your transcript will appear here."}
                  </span>
                )}
              </div>

              {transcription.error && (
                <p className="mt-2 text-sm text-red-400">
                  {transcription.error}
                </p>
              )}
            </Section>

            {/* Step 3: Generate Note */}
            <Section number={3} title="Generate a note">
              <p className="mb-4 text-sm text-zinc-500">
                The SDK sends the transcript and selected template to the
                Scribeberry API, which returns a structured medical note.
              </p>

              <button
                onClick={generateNote}
                disabled={!canGenerate}
                className="inline-flex items-center gap-2 rounded-lg bg-white/[0.1] px-5 py-2.5 text-sm font-medium text-zinc-200 shadow-sm transition-all hover:bg-white/[0.15] focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {generatingNote && <Spinner />}
                {generatingNote ? "Generating…" : "Generate Note"}
              </button>

              {noteError && (
                <p className="mt-3 text-sm text-red-400">{noteError}</p>
              )}

              {noteResult && (
                <div className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.04] shadow-sm">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                    <span className="text-sm font-medium text-zinc-200">
                      {noteResult.template.name || "Generated Note"}
                    </span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          noteResult.note.markdown
                        )
                      }
                      className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="max-w-none p-5">
                    {noteResult.note.markdown.split("\n").map((line, i) => {
                      if (line.startsWith("# ")) {
                        return (
                          <h2
                            key={i}
                            className="mb-2 mt-4 text-base font-semibold text-zinc-100 first:mt-0"
                          >
                            {line.slice(2)}
                          </h2>
                        );
                      }
                      if (line.startsWith("## ")) {
                        return (
                          <h3
                            key={i}
                            className="mb-1 mt-3 text-sm font-semibold text-zinc-200"
                          >
                            {line.slice(3)}
                          </h3>
                        );
                      }
                      if (line.startsWith("### ")) {
                        return (
                          <h4
                            key={i}
                            className="mb-1 mt-2 text-sm font-medium text-zinc-300"
                          >
                            {line.slice(4)}
                          </h4>
                        );
                      }
                      if (line.startsWith("- ")) {
                        return (
                          <li key={i} className="ml-4 text-sm text-zinc-400">
                            {line.slice(2)}
                          </li>
                        );
                      }
                      if (line.trim() === "") {
                        return <div key={i} className="h-2" />;
                      }
                      return (
                        <p key={i} className="text-sm text-zinc-400">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <p className="text-xs text-zinc-600">
            Built with{" "}
            <a
              href="https://www.npmjs.com/package/@scribeberry/sdk"
              className="underline hover:text-zinc-400"
            >
              @scribeberry/sdk
            </a>{" "}
            + Next.js
          </p>
          <a
            href="https://console.scribeberry.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 underline hover:text-zinc-400"
          >
            Documentation
          </a>
        </div>
      </footer>
    </div>
  );
}

// ── Setup Guide ────────────────────────────────────────────────────────

function SetupGuide() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15">
            <KeyIcon />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              API Key Required
            </h2>
            <p className="text-sm text-zinc-500">
              A few quick steps to get started
            </p>
          </div>
        </div>

        <ol className="space-y-5">
          <SetupStep number={1} title="Get an API key">
            <p>
              Sign up or log in at{" "}
              <a
                href="https://console.scribeberry.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-400 underline decoration-emerald-400/30 hover:decoration-emerald-400"
              >
                console.scribeberry.com
              </a>{" "}
              and create an API key for your project.
            </p>
          </SetupStep>

          <SetupStep number={2} title="Create your env file">
            <p className="mb-2">
              Copy the example file and add your key:
            </p>
            <code className="block rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300">
              <span className="text-zinc-500">$</span> cp .env.example .env.local
              <br />
              <br />
              <span className="text-zinc-500"># then edit .env.local:</span>
              <br />
              SCRIBEBERRY_API_KEY=<span className="text-emerald-400">sk_test_your_key_here</span>
            </code>
          </SetupStep>

          <SetupStep number={3} title="Restart the dev server">
            <p>
              Next.js only reads <span className="font-mono text-zinc-300">.env.local</span> on
              startup. Restart with:
            </p>
            <code className="mt-2 block rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-3 font-mono text-xs text-zinc-300">
              <span className="text-zinc-500">$</span> npm run dev
            </code>
          </SetupStep>
        </ol>

        <div className="mt-6 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-xs leading-relaxed text-zinc-500">
            Your API key is only used server-side — it never reaches the
            browser. The app checks for its presence via a status endpoint that
            returns a boolean, not the key itself.
          </p>
        </div>
      </div>
    </div>
  );
}

function SetupStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-medium text-emerald-400">
        {number}
      </span>
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-200">{title}</h3>
        <div className="text-sm leading-relaxed text-zinc-400">{children}</div>
      </div>
    </li>
  );
}

// ── Layout Components ──────────────────────────────────────────────────

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-medium text-emerald-400">
          {number}
        </span>
        <h2 className="text-base font-semibold text-zinc-200">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────

function KeyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5 text-amber-400"
    >
      <path
        fillRule="evenodd"
        d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1.586a1 1 0 0 1 .293-.707l5.964-5.964A5.014 5.014 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
      <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
    </svg>
  );
}

function PulsingDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-400" />
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
