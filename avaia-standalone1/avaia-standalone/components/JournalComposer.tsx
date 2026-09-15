"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MicButton from "@/components/MicButton";

/** The one Journal composer, reused for both "Write" and "Talk" -- they are
 *  the same form and the same textarea underneath, differing only in which
 *  action is visually primary. AVAIA never replies here: no message
 *  thread, no streamed response, just this box and Save. See
 *  app/api/journal/route.ts for why -- this is deliberately the simplest
 *  save flow in the app.
 *
 *  "Talk" does not auto-start dictation on page load: most browsers only
 *  grant microphone access from a genuine user click, not a script-fired
 *  one, so a silent auto-start would frequently just fail. Instead the mic
 *  itself is the large, obvious, first thing offered -- one real tap away,
 *  never a polished answer required first. */
export default function JournalComposer({
  autoTalk,
  promptLabel,
}: {
  /** Whether the Host arrived via "Talk" (mic offered as the primary,
   *  large action) or "Write" (a focused blank textarea, mic still
   *  available as the small corner icon). Purely a starting emphasis --
   *  either way the Host can type, talk, or both in the same entry. */
  autoTalk: boolean;
  /** The optional ponder-prompt label the Host picked, if any (see
   *  lib/journal.ts's JOURNAL_PROMPTS) -- shown as a one-line hint above
   *  the textarea, never sent to any model, never a question AVAIA asks. */
  promptLabel?: string | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stopSignal, setStopSignal] = useState(0);
  const [usedMic, setUsedMic] = useState(false);

  const canSave = content.trim() !== "" && !saving;

  async function save() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    setStopSignal((n) => n + 1);
    setError("");
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          // Reflects how this particular entry was actually captured, not
          // just which button opened the page -- if the Host arrived via
          // "Write" but used the mic anyway (or vice versa), the mic's own
          // use decides it.
          entryMethod: usedMic ? "talk" : "write",
          context: promptLabel ? { source: "prompt", label: promptLabel } : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save your entry.");
      router.push(`/workbook/journal/${data.entry.id}?saved=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      {promptLabel && (
        <p className="mb-3 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-sm text-muted">
          <span className="label mr-2 text-seal">Prompt</span>
          {promptLabel}
        </p>
      )}

      {autoTalk && (
        <div className="mb-4 flex flex-col items-center rounded-lg border border-rule bg-white/[0.04] py-8">
          <div className="relative h-14 w-14">
            <MicButton
              value={content}
              onChange={(t) => {
                setUsedMic(true);
                setContent(t);
              }}
              disabled={saving}
              stopSignal={stopSignal}
            />
          </div>
          <p className="mt-3 text-sm text-muted">Tap the mic, then just talk.</p>
        </div>
      )}

      <div className="relative">
        <textarea
          autoFocus={!autoTalk}
          rows={10}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={saving}
          placeholder="Write, or tap the mic and talk. There's no right way to start."
          className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 pr-14 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
        {!autoTalk && (
          <MicButton
            value={content}
            onChange={(t) => {
              setUsedMic(true);
              setContent(t);
            }}
            disabled={saving}
            stopSignal={stopSignal}
          />
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Entry"}
        </button>
        <p className="text-xs text-muted">Private. Only you will ever see this.</p>
      </div>

      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}
    </div>
  );
}
