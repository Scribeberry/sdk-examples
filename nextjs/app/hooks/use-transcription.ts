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
 * AudioWorklet processor source code, inlined as a Blob URL.
 *
 * Collects Float32 audio frames and converts them to Int16 PCM,
 * then posts the buffer to the main thread via MessagePort.
 */
const WORKLET_SOURCE = `
class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    const int16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)));
    }
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}
registerProcessor("pcm-processor", PcmProcessor);
`;

/**
 * React hook for realtime speech-to-text using the Scribeberry SDK.
 *
 * Handles microphone access, audio processing (via AudioWorklet), and
 * WebSocket streaming. Uses the recommended `getRealtimeToken` callback
 * pattern so the API key is never exposed to the browser.
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
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const cleanup = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;

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

      // Request microphone access early so the user sees the permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // Set up AudioContext and register the worklet processor
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const blob = new Blob([WORKLET_SOURCE], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletNodeRef.current = workletNode;

      // Forward PCM buffers from the worklet to the SDK session
      workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        try {
          sessionRef.current?.sendAudio(e.data);
        } catch {
          // Session closing — safe to ignore
        }
      };

      // Start the transcription session
      const session = sb.realtime.transcribe({
        language: "en-US",
        enableDiarization: true,
      });
      sessionRef.current = session;

      // Wait for the WebSocket to be ready before streaming audio.
      session.on("started", () => {
        source.connect(workletNode);
        workletNode.connect(audioCtx.destination);
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
