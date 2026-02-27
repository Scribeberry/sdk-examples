/**
 * Scribeberry SDK — Express + Vanilla JS Example
 *
 * This file demonstrates how to use the Scribeberry SDK without React or
 * any framework. It handles microphone access, audio processing via
 * AudioWorklet, and WebSocket streaming using the SDK's core API directly.
 *
 * The SDK is loaded from a CDN so there's no build step required.
 */

// ── SDK import (from CDN — no build step needed) ───────────────────────

const { Scribeberry } = await import(
  "https://esm.sh/@scribeberry/sdk@0.3.0"
);

// ── DOM Elements ───────────────────────────────────────────────────────

const els = {
  templateSelect: document.getElementById("template-select"),
  recordBtn: document.getElementById("record-btn"),
  clearBtn: document.getElementById("clear-btn"),
  duration: document.getElementById("duration"),
  transcriptBox: document.getElementById("transcript-box"),
  recordError: document.getElementById("record-error"),
  generateBtn: document.getElementById("generate-btn"),
  generateError: document.getElementById("generate-error"),
  noteCard: document.getElementById("note-card"),
  noteTitle: document.getElementById("note-title"),
  noteContent: document.getElementById("note-content"),
  copyBtn: document.getElementById("copy-btn"),
};

// ── State ──────────────────────────────────────────────────────────────

let transcript = "";
let partial = "";
let recording = false;
let session = null;
let audioCtx = null;
let mediaStream = null;
let workletNode = null;
let source = null;
let noteMarkdown = "";

// ── AudioWorklet processor (inlined as Blob URL) ───────────────────────

const WORKLET_SOURCE = `
class ScribeberryPcmProcessor extends AudioWorkletProcessor {
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
registerProcessor("scribeberry-pcm", ScribeberryPcmProcessor);
`;

// ── Templates ──────────────────────────────────────────────────────────

async function loadTemplates() {
  try {
    const res = await fetch("/api/templates");
    const data = await res.json();
    const templates = data.items ?? [];

    if (templates.length === 0) {
      els.templateSelect.innerHTML =
        '<option disabled>No templates found</option>';
      return;
    }

    els.templateSelect.innerHTML = templates
      .map(
        (t) =>
          `<option value="${t.id}">${t.name}${t.description ? ` — ${t.description}` : ""}</option>`
      )
      .join("");
    els.templateSelect.disabled = false;
  } catch (err) {
    els.templateSelect.innerHTML =
      '<option disabled>Failed to load templates</option>';
  }
}

// ── Transcription ──────────────────────────────────────────────────────

function renderTranscript() {
  if (!transcript && !partial) {
    els.transcriptBox.innerHTML = `<span class="placeholder">${
      recording ? "Listening…" : "Your transcript will appear here."
    }</span>`;
  } else {
    els.transcriptBox.innerHTML =
      `<span>${transcript}</span>` +
      (partial
        ? `<span class="partial">${transcript ? " " : ""}${partial}</span>`
        : "");
  }
}

function updateControls() {
  els.recordBtn.className = `btn ${recording ? "btn-stop" : "btn-record"}`;
  els.recordBtn.innerHTML = recording
    ? '<div class="pulse-dot"></div> Stop Recording'
    : "🎙 Start Recording";

  els.clearBtn.classList.toggle("hidden", !transcript || recording);
  els.generateBtn.disabled = !transcript || recording;

  els.transcriptBox.classList.toggle("recording", recording);
}

function cleanup() {
  workletNode?.disconnect();
  source?.disconnect();
  audioCtx?.close();
  mediaStream?.getTracks().forEach((t) => t.stop());
  workletNode = null;
  source = null;
  audioCtx = null;
  mediaStream = null;
  session = null;
}

async function startRecording() {
  try {
    els.recordError.classList.add("hidden");

    // Initialize SDK with a token callback
    const sb = new Scribeberry({
      getRealtimeToken: async () => {
        const res = await fetch("/api/realtime-token", { method: "POST" });
        if (!res.ok) throw new Error("Failed to get realtime token");
        return res.json();
      },
    });

    // Request microphone
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Set up AudioContext and AudioWorklet
    audioCtx = new AudioContext({ sampleRate: 16000 });
    const blob = new Blob([WORKLET_SOURCE], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    await audioCtx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    source = audioCtx.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(audioCtx, "scribeberry-pcm");

    // Forward PCM to the SDK session
    workletNode.port.onmessage = (e) => {
      try {
        session?.sendAudio(e.data);
      } catch {
        // Session closing
      }
    };

    // Start transcription session
    session = sb.realtime.transcribe({
      language: "en-US",
      enableDiarization: true,
    });

    // Connect audio only when the WebSocket is ready
    session.on("started", () => {
      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);
      recording = true;
      updateControls();
      renderTranscript();
    });

    session.on("partial", (text) => {
      partial = text;
      renderTranscript();
    });

    session.on("final", (segment) => {
      transcript += (transcript ? " " : "") + segment.text;
      partial = "";
      renderTranscript();
    });

    session.on("error", (err) => {
      els.recordError.textContent = err.message;
      els.recordError.classList.remove("hidden");
      recording = false;
      cleanup();
      updateControls();
    });

    session.on("stopped", (result) => {
      recording = false;
      if (result.durationSeconds) {
        const m = Math.floor(result.durationSeconds / 60);
        const s = Math.round(result.durationSeconds % 60);
        els.duration.textContent = m > 0 ? `${m}m ${s}s` : `${s}s`;
        els.duration.classList.remove("hidden");
      }
      updateControls();
      renderTranscript();
    });
  } catch (err) {
    els.recordError.textContent = err.message || "Failed to start recording";
    els.recordError.classList.remove("hidden");
    recording = false;
    cleanup();
    updateControls();
  }
}

async function stopRecording() {
  if (!session) return;
  els.recordBtn.disabled = true;
  els.recordBtn.innerHTML = '<div class="spinner"></div> Stopping…';
  try {
    await session.stop();
  } finally {
    cleanup();
    els.recordBtn.disabled = false;
    updateControls();
  }
}

// ── Note Generation ────────────────────────────────────────────────────

function renderMarkdown(md) {
  return md
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h2>${line.slice(2)}</h2>`;
      if (line.startsWith("## ")) return `<h3>${line.slice(3)}</h3>`;
      if (line.startsWith("### ")) return `<h4>${line.slice(4)}</h4>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === "") return "<br>";
      return `<p>${line}</p>`;
    })
    .join("");
}

async function generateNote() {
  const templateId = els.templateSelect.value;
  if (!templateId || !transcript) return;

  els.generateBtn.disabled = true;
  els.generateBtn.innerHTML = '<div class="spinner"></div> Generating…';
  els.generateError.classList.add("hidden");
  els.noteCard.classList.add("hidden");

  try {
    const res = await fetch("/api/notes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, conversationText: transcript }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate note");

    noteMarkdown = data.note.markdown;
    els.noteTitle.textContent = data.template?.name || "Generated Note";
    els.noteContent.innerHTML = renderMarkdown(noteMarkdown);
    els.noteCard.classList.remove("hidden");
  } catch (err) {
    els.generateError.textContent = err.message;
    els.generateError.classList.remove("hidden");
  } finally {
    els.generateBtn.disabled = !transcript;
    els.generateBtn.textContent = "Generate Note";
  }
}

// ── Event Listeners ────────────────────────────────────────────────────

els.recordBtn.addEventListener("click", () => {
  recording ? stopRecording() : startRecording();
});

els.clearBtn.addEventListener("click", () => {
  transcript = "";
  partial = "";
  noteMarkdown = "";
  els.duration.classList.add("hidden");
  els.noteCard.classList.add("hidden");
  els.generateError.classList.add("hidden");
  els.recordError.classList.add("hidden");
  updateControls();
  renderTranscript();
});

els.generateBtn.addEventListener("click", generateNote);

els.copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(noteMarkdown);
  els.copyBtn.textContent = "Copied!";
  setTimeout(() => (els.copyBtn.textContent = "Copy"), 1500);
});

// ── Init ───────────────────────────────────────────────────────────────

loadTemplates();
renderTranscript();

