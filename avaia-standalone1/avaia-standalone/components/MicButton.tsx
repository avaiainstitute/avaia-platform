"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Voice-to-text via the browser's built-in Web Speech API — no server, no cost.
 * Tap to speak; words appear live in the input; tap again to stop. Renders
 * nothing where speech recognition isn't available (mobile keyboards have their
 * own dictation mic as a fallback). Appends to whatever is already typed.
 */
export default function MicButton({
  value,
  onChange,
  disabled,
  stopSignal,
}: {
  value: string;
  onChange: (t: string) => void;
  disabled?: boolean;
  /** Increment to force-stop dictation and forget it (e.g. the Host just sent). */
  stopSignal?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  // Speech API isn't in the TS DOM lib; keep these loosely typed.
  const recRef = useRef<any>(null);
  const baseRef = useRef("");
  const finalRef = useRef("");
  // When true, ignore any late recognition events — otherwise speech that
  // finalizes after send would re-populate the input the Host just cleared.
  const discardRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // External reset — stop listening and drop whatever was dictated so it can't
  // be written back into the box after the message was sent.
  useEffect(() => {
    if (stopSignal === undefined) return;
    discardRef.current = true;
    baseRef.current = "";
    finalRef.current = "";
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, [stopSignal]);

  function start() {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    const cur = valueRef.current.trim();
    baseRef.current = cur ? cur + " " : "";
    finalRef.current = "";
    discardRef.current = false;

    rec.onresult = (e: any) => {
      if (discardRef.current) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      onChange(baseRef.current + finalRef.current + interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (discardRef.current) return;
      onChange((baseRef.current + finalRef.current).trim());
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? "Stop speaking" : "Speak your reply"}
      title={listening ? "Stop" : "Speak"}
      className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        listening
          ? "border-[#d1352b] bg-[#d1352b]/20 text-[#e6b3ac]"
          : "border-rule text-muted hover:border-seal hover:text-ink"
      }`}
    >
      {listening && (
        <span className="absolute inset-0 animate-ping rounded-full border border-[#d1352b]/50" />
      )}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
