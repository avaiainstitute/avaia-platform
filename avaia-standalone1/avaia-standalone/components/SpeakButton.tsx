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

// Sentinel placeholders used only inside stripPresentationalMarkdown, to
// shield a span of text from the passes below and restore it afterward.
// Built via fromCharCode from Private Use Area code points (never
// otherwise produced by assistant text, so they can't collide with real
// content) rather than written as \u escape literals -- those were
// silently mangled into different characters when saved through this
// editing pipeline, the same class of corruption seen earlier this
// session with smart-quote substitution during a SQL paste. fromCharCode
// keeps the source file itself plain ASCII, with nothing for any such
// layer to reinterpret.
const ESCAPED_ASTERISK = String.fromCharCode(0xe000);
const ESCAPED_UNDERSCORE = String.fromCharCode(0xe001);
const ESCAPED_HASH = String.fromCharCode(0xe002);
const ESCAPED_DASH = String.fromCharCode(0xe003);
const PROTECTED_MULTIPLY = String.fromCharCode(0xe004);

/** Strips presentational Markdown before text is spoken, so formatting
 *  characters aren't read aloud literally.
 *
 *  A prior version only stripped *paired* emphasis markers (a leftover,
 *  unmatched "*" -- e.g. "risk*" or "*risk" -- was deliberately left
 *  alone). That turned out to be the actual remaining production case:
 *  real assistant output isn't always cleanly paired, and the unpaired
 *  marker was the literal "*" the speech engine was reading aloud.
 *  Asterisks have essentially one legitimate non-markdown use in AVAIA's
 *  conversational content -- multiplication ("3 * 4") -- which is
 *  protected explicitly below; every other asterisk, paired or not, is
 *  removed outright rather than relying on pairing logic that malformed
 *  or streamed markdown can defeat.
 *
 *  Underscores can't use the same blanket approach, because "_" doubles
 *  as both a markdown marker and a legitimate identifier character
 *  (snake_case, left_join) -- so a leftover single underscore is only
 *  removed when it's flush against a word on exactly one side (the
 *  signature of a stray emphasis marker); flush on *both* sides (a
 *  mid-word underscore) is left alone. A doubled "__" is stripped as an
 *  explicit pair first, since "_" is itself a word character and would
 *  otherwise make each half of "__" look flush against the other.
 *
 *  \-escaped punctuation (CommonMark's "treat this literally" syntax) is
 *  protected before any of the above runs, so a deliberate `\*` or `\_`
 *  survives as the literal character rather than being read as -- or
 *  mistaken for -- formatting.
 *
 *  Deliberately avoids lookbehind assertions (`(?<=...)`) -- unsupported
 *  in Safari before 16.4, which would throw a SyntaxError on this regex
 *  and break Read Aloud entirely on those browsers.
 *
 *  Only affects what's spoken; the visible, rendered response (RichText)
 *  is completely untouched by this function. */
function stripPresentationalMarkdown(text: string): string {
  const working = text
    // \-escaped punctuation -- protected first so it's never mistaken for
    // real markdown syntax by the passes below, then restored as the
    // literal character (minus the backslash) at the very end.
    .replace(/\\\*/g, ESCAPED_ASTERISK)
    .replace(/\\_/g, ESCAPED_UNDERSCORE)
    .replace(/\\#/g, ESCAPED_HASH)
    .replace(/\\-/g, ESCAPED_DASH)
    // genuine multiplication ("3 * 4") -- protected before the blanket
    // asterisk removal below.
    .replace(/(\d)(\s+)\*(\s+)(\d)/g, `$1$2${PROTECTED_MULTIPLY}$3$4`)
    // heading markers, horizontal rules, bullet markers
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    // __bold__ as an explicit pair (see note above on why "_" needs this)
    .replace(/__(\S(?:[\s\S]*?\S)?)__/g, "$1")
    // any remaining single underscore flush against a word on exactly one
    // side -- a leftover emphasis marker, paired or not. No lookbehind:
    // the left-hand check uses a capture group instead.
    .replace(/(^|[^\w])_(?=\w)/g, "$1")
    .replace(/(\w)_(?!\w)/g, "$1")
    // every remaining asterisk -- paired, unmatched, or however many in a
    // row -- is a markdown delimiter, not content, now that multiplication
    // is protected.
    .replace(/\*/g, "")
    // tidy up double spaces left behind by a removed stray marker; line
    // breaks (list rhythm, paragraph pauses) are untouched.
    .replace(/[ \t]{2,}/g, " ");

  return working
    .replace(new RegExp(PROTECTED_MULTIPLY, "g"), "*")
    .replace(new RegExp(ESCAPED_ASTERISK, "g"), "*")
    .replace(new RegExp(ESCAPED_UNDERSCORE, "g"), "_")
    .replace(new RegExp(ESCAPED_HASH, "g"), "#")
    .replace(new RegExp(ESCAPED_DASH, "g"), "-");
}

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
    const spoken = stripPresentationalMarkdown(text);
    // Dev-safe diagnostic: only logs when stripping actually changed
    // something, and only the two strings involved -- lets RAW vs SPOKEN
    // be compared directly in the browser console (including in
    // production, via DevTools) for whatever real message triggered a
    // "reads a symbol aloud" report, without adding any UI. A leftover
    // "*" or lone "_" in SPOKEN after this fix is the signal to look at.
    if (spoken !== text) {
      console.debug("[AVAIA Read Aloud] RAW:", text, "\n[AVAIA Read Aloud] SPOKEN:", spoken);
    }
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
