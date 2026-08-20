"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Voice-to-text via the browser's built-in Web Speech API — no server, no cost.
 * Tap to speak; words appear live in the input; tap again to stop. Renders
 * nothing where speech recognition isn't available (mobile keyboards have their
 * own dictation mic as a fallback). Appends to whatever is already typed.
 *
 * Transcription quality: every word AND every punctuation mark this
 * component initially receives (r[0].transcript on each result) is already
 * final -- produced entirely by the browser/OS speech-recognition service
 * before any of this code runs. In `continuous` mode that service decides
 * on its own, per detected pause, where one `isFinal` result ends and the
 * next begins, each arriving with whatever terminal punctuation the
 * recognizer itself chose -- with no exposed confidence score, pause
 * duration, or alternate segmentation for this component to re-derive that
 * decision from itself. That's the actual source of dictation reading as
 * unnaturally short, over-punctuated fragments. Two things happen about it:
 * (1) below, purely mechanically -- capitalizing the very first letter of a
 * fresh dictation (an unambiguous position, unlike any internal sentence
 * boundary) and never leaving the live preview missing a space at a
 * segment join; (2) once dictation ends, the raw transcript is shown
 * immediately, then handed to /api/transcript-cleanup -- a narrow,
 * separate model call whose only job is fixing wrongly-placed punctuation,
 * restoring sentence/paragraph boundaries, capitalization, and obvious
 * unambiguous homophones (see that route's system prompt for the exact,
 * tightly-scoped instructions and its own word-count safety check) -- and
 * swapped in if it returns before the Host has already edited or re-spoken
 * (see cleanup() below). Any failure there just leaves the raw transcript
 * exactly as already shown.
 */
/** Uppercases only the first letter found in a string -- every other
 *  character, word, and punctuation mark is untouched. Used once, at the
 *  very start of a fresh dictation (see start() below), never mid-utterance
 *  -- capitalizing there would require guessing at a sentence boundary,
 *  exactly the judgment call this file's top comment explains why we don't
 *  make. */
function capitalizeFirst(s: string): string {
  const i = s.search(/[a-z]/i);
  if (i === -1) return s;
  return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}

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
  // True while a just-finished dictation's punctuation/capitalization pass
  // (see cleanup() below) is in flight.
  const [cleaning, setCleaning] = useState(false);
  // Speech API isn't in the TS DOM lib; keep these loosely typed.
  const recRef = useRef<any>(null);
  const baseRef = useRef("");
  const finalRef = useRef("");
  // When true, ignore any late recognition events — otherwise speech that
  // finalizes after send would re-populate the input the Host just cleared.
  const discardRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Identifies which dictation a pending cleanup call belongs to, so a
  // cleanup response that arrives after the Host has already started a new
  // dictation never overwrites it.
  const dictationIdRef = useRef(0);

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

  /** Sends the text dictated in this turn only (not the whole box -- `base`
   *  is whatever was already there before this dictation started) to
   *  /api/transcript-cleanup for punctuation/capitalization/obvious-
   *  homophone correction only (see that route's system prompt). Applies
   *  the result only if nothing has invalidated it since: a newer
   *  dictation started (`id` mismatch), the box was reset (`discardRef`),
   *  or the Host already edited the box themselves (`valueRef` no longer
   *  matches what was handed off) -- in any of those cases this silently
   *  does nothing rather than clobber something newer. Any fetch failure
   *  just leaves the raw dictated text exactly as already shown. */
  async function cleanup(id: number, dictated: string, base: string, rawFullValue: string) {
    setCleaning(true);
    try {
      const res = await fetch("/api/transcript-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: dictated }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const cleaned = typeof data?.cleaned === "string" ? data.cleaned.trim() : "";
      if (!cleaned) return;
      if (id !== dictationIdRef.current) return;
      if (discardRef.current) return;
      if (valueRef.current !== rawFullValue) return;
      onChange((base + cleaned).trim());
    } catch {
      /* keep the raw transcript already shown */
    } finally {
      if (id === dictationIdRef.current) setCleaning(false);
    }
  }

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
    dictationIdRef.current += 1;
    const dictationId = dictationIdRef.current;

    rec.onresult = (e: any) => {
      if (discardRef.current) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          const needsSpace = finalRef.current.length > 0 && !/\s$/.test(finalRef.current);
          let chunk = r[0].transcript;
          // Only the very first finalized chunk of a dictation that started
          // in an empty input -- see this file's top comment for why this
          // is the one position safe to touch.
          if (!baseRef.current && !finalRef.current) chunk = capitalizeFirst(chunk);
          finalRef.current += (needsSpace ? " " : "") + chunk;
        } else {
          interim += r[0].transcript;
        }
      }
      const needsInterimSpace =
        interim.length > 0 && finalRef.current.length > 0 && !/\s$/.test(finalRef.current);
      onChange(baseRef.current + finalRef.current + (needsInterimSpace ? " " : "") + interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (discardRef.current) return;
      const raw = (baseRef.current + finalRef.current).trim();
      onChange(raw);
      const dictated = finalRef.current.trim();
      if (dictated) cleanup(dictationId, dictated, baseRef.current, raw);
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
      aria-label={listening ? "Stop speaking" : cleaning ? "Cleaning up your dictation" : "Speak your reply"}
      title={listening ? "Stop" : cleaning ? "Cleaning up…" : "Speak"}
      className={`absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        listening
          ? "border-[#d1352b] bg-[#d1352b]/20 text-[#e6b3ac]"
          : cleaning
            ? "border-seal text-seal"
            : "border-rule text-muted hover:border-seal hover:text-ink"
      }`}
    >
      {listening && (
        <span className="absolute inset-0 animate-ping rounded-full border border-[#d1352b]/50" />
      )}
      {cleaning && !listening && (
        <span className="absolute inset-0 animate-ping rounded-full border border-seal/50" />
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
