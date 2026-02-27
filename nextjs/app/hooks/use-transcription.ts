"use client";

import { useCallback, useRef, useState } from "react";
import {
  Scribeberry,
  type RealtimeTranscriptionSession,
  type TranscriptSegment,
} from "@scribeberry/sdk";

export type TranscriptionStatus = "idle" | "connecting" | "recording" | "error";

interface TranscriptionState {
  /** Current status of the transcription session. */
  status: TranscriptionStatus;
  /** Confirmed transcript segments (stable text). */
  segments: TranscriptSegment[];
  /** Interim text that updates rapidly as words are recognized. */
  partial: string;
  /** Full confirmed transcript as a single string. */
  transcript: string;
  /** Duration of the session in seconds (set after stop). */
  durationSeconds: number | null;
  /** Error message if something went wrong. */
  error: string | null;
}

interface TranscriptionActions {
  /** Start recording and transcribing from the microphone. */
  start: () => Promise<void>;
  /** Stop recording and return the final transcript. */
  stop: () => Promise<void>;
  /** Clear the transcript and reset to idle state. */
  clear: () => void;
}

const INITIAL_STATE: TranscriptionState = {
  status: "idle",
  segments: [],
  partial: "",
  transcript: "",
  durationSeconds: null,
  error: null,
};

/**
 * React hook for realtime speech-to-text using the Scribeberry SDK.
 *
 * Handles microphone access, audio processing, and WebSocket streaming.
 * Uses the recommended `getRealtimeToken` callback pattern so the API key
 * is never exposed to the browser.
 *
 * @example
 * ```tsx
 * const { status, transcript, partial, start, stop, clear } = useTranscription();
 *
 * return (
 *   <div>
 *     <button onClick={status === "recording" ? stop : start}>
 *       {status === "recording" ? "Stop" : "Record"}
 *     </button>
 *     <p>{transcript}{partial}</p>
 *   </div>
 * );
 * ```
 */
export function useTranscription(): TranscriptionState & TranscriptionActions {
  const [state, setState] = useState<TranscriptionState>(INITIAL_STATE);

  const sessionRef = useRef<RealtimeTranscriptionSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    sessionRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      setState((s) => ({ ...s, status: "connecting", error: null }));

      // Initialize the SDK with a token callback (API key stays server-side)
      const sb = new Scribeberry({
        getRealtimeToken: async () => {
          const res = await fetch("/api/realtime-token", { method: "POST" });
          if (!res.ok) throw new Error("Failed to get realtime token");
          return res.json();
        },
      });

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Set up audio processing (PCM 16-bit, 16kHz, mono)
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Start the transcription session
      const session = sb.realtime.transcribe({
        language: "en-US",
        enableDiarization: true,
      });
      sessionRef.current = session;

      // Wire up event handlers
      session.on("started", () => {
        setState((s) => ({ ...s, status: "recording" }));
      });

      session.on("partial", (text) => {
        setState((s) => ({ ...s, partial: text }));
      });

      session.on("final", (segment) => {
        setState((s) => ({
          ...s,
          segments: [...s.segments, segment],
          transcript: s.transcript + (s.transcript ? " " : "") + segment.text,
          partial: "",
        }));
      });

      session.on("error", (err) => {
        setState((s) => ({
          ...s,
          status: "error",
          error: err.message,
        }));
        cleanup();
      });

      session.on("stopped", (result) => {
        setState((s) => ({
          ...s,
          status: "idle",
          partial: "",
          durationSeconds: result.durationSeconds,
        }));
      });

      // Stream microphone audio to the session
      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(
            -32768,
            Math.min(32767, Math.round(float32[i] * 32767))
          );
        }
        sessionRef.current.sendAudio(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start transcription";
      setState((s) => ({ ...s, status: "error", error: message }));
      cleanup();
    }
  }, [cleanup]);

  const stop = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await sessionRef.current.stop();
    } finally {
      cleanup();
    }
  }, [cleanup]);

  const clear = useCallback(() => {
    cleanup();
    setState(INITIAL_STATE);
  }, [cleanup]);

  return { ...state, start, stop, clear };
}

