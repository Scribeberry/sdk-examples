"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranscription } from "./hooks/use-transcription";
import type { Template, GenerateNoteResult } from "@scribeberry/sdk";

export default function Home() {
  // ── Template selection ──────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  useEffect(() => {
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
  }, []);

  // ── Realtime transcription ──────────────────────────────────────────
  const transcription = useTranscription();

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
        {/* ── Step 1: Choose Template ───────────────────────────────── */}
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

        {/* ── Step 2: Record ────────────────────────────────────────── */}
        <Section number={2} title="Record a conversation">
          <p className="mb-4 text-sm text-zinc-500">
            Click record and speak into your microphone. The transcript updates
            in real-time.
          </p>

          {/* Recording controls */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={isRecording ? transcription.stop : transcription.start}
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

          {/* Transcript display */}
          <div
            className={`min-h-[120px] rounded-lg border p-4 text-sm leading-relaxed transition-colors ${
              isRecording
                ? "border-emerald-500/20 bg-emerald-500/[0.06]"
                : "border-white/[0.08] bg-white/[0.03]"
            }`}
          >
            {hasTranscript || transcription.partial ? (
              <>
                <span className="text-zinc-200">{transcription.transcript}</span>
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
            <p className="mt-2 text-sm text-red-400">{transcription.error}</p>
          )}
        </Section>

        {/* ── Step 3: Generate Note ─────────────────────────────────── */}
        <Section number={3} title="Generate a note">
          <p className="mb-4 text-sm text-zinc-500">
            The SDK sends the transcript and selected template to the Scribeberry
            API, which returns a structured medical note.
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
                    navigator.clipboard.writeText(noteResult.note.markdown)
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
                      <h2 key={i} className="mb-2 mt-4 text-base font-semibold text-zinc-100 first:mt-0">
                        {line.slice(2)}
                      </h2>
                    );
                  }
                  if (line.startsWith("## ")) {
                    return (
                      <h3 key={i} className="mb-1 mt-3 text-sm font-semibold text-zinc-200">
                        {line.slice(3)}
                      </h3>
                    );
                  }
                  if (line.startsWith("### ")) {
                    return (
                      <h4 key={i} className="mb-1 mt-2 text-sm font-medium text-zinc-300">
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
