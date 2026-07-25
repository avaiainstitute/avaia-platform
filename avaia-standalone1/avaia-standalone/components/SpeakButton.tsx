"use client";

import { useEffect, useState } from "react";

/**
 * Read-aloud via the browser's built-in Web Speech API (speechSynthesis) — free,
 * on-device, private (no server, no API key). Tap to hear the Guide's words; tap
 * again to stop. Renders nothing where speech synthesis isn't available.
 */
// Devices default to a flat, robotic voice even when a far more natural one is
// installed. Prefer the known-good natural voices, in order.
const PREFERRED = [
  "google us english",
  "samantha",
  "ava",
  "allison",
  "aria",
  "jenny",
  "natural",
  "neural",
  "siri",
];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  if (voices.length === 0) return null;
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length > 0 ? en : voices;
  for (const want of PREFERRED) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(want));
    if (hit) return hit;
  }
  // Avoid the low-quality "compact" variants when a full one exists.
  return pool.find((v) => !v.name.toLowerCase().includes("compact")) ?? pool[0];
}

export default function SpeakButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    // Voice list often loads asynchronously — touch it so it's ready.
    try {
      window.speechSynthesis?.getVoices();
      window.speechSynthesis?.addEventListener?.("voiceschanged", pickVoice);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        window.speechSynthesis?.removeEventListener?.("voiceschanged", pickVoice);
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function toggle() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking || synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    // Strip the light markdown so it isn't read out as "asterisk asterisk".
    const spoken = text
      .replace(/\*\*/g, "")
      .replace(/(^|\s)\*(\S)/g, "$1$2")
      .replace(/^\s*#{1,4}\s+/gm, "")
      .replace(/^\s*[-*_]{3,}\s*$/gm, "")
      .replace(/^\s*[-*•]\s+/gm, "");
    const u = new SpeechSynthesisUtterance(spoken);
    const voice = pickVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = 0.98;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  if (!supported || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={speaking ? "Stop reading aloud" : "Read this aloud"}
      title={speaking ? "Stop" : "Read aloud"}
      className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
        speaking ? "text-seal" : "text-muted hover:text-ink"
      }`}
    >
      {speaking ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
      {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}
