"use client";

import { useState } from "react";

/** The interactive Preparation workspace -- built to close the gap between
 *  PreparationSnapshot.tsx (a single generated summary) and what the
 *  original Preparation capability was meant to support: the Guide
 *  actually asking Preparation things. Turn by turn, bounded calls (see
 *  generatePreparationChatReply's own comment for why), never a streamed
 *  live conversation, never persisted -- this is Guide-only scratch work
 *  for preparing the next Host conversation, not itself part of any
 *  continuity record. Sits below PreparationSnapshot on the same page. */

type Turn = { role: "guide" | "preparation"; content: string };

const SUGGESTED_PROMPTS = [
  "What questions might be worth revisiting?",
  "What seems unfinished or still active?",
  "Any existing activities that might fit what became visible?",
  "What Chemistry elements became visible, and why?",
  "Any Secondary Losses that might be worth asking about?",
  "Give me a few different ways to approach the next conversation.",
  "What should I be careful not to take over?",
];

export default function PreparationChat({ participantId }: { participantId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(message: string) {
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    const nextTurns: Turn[] = [...turns, { role: "guide", content: message }];
    setTurns(nextTurns);
    setInput("");
    try {
      const res = await fetch("/api/preparation/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, message, priorTurns: turns }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reach Preparation.");
      setTurns([...nextTurns, { role: "preparation", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setTurns(turns);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-rule bg-white/[0.04] p-5">
      <p className="label text-muted">Ask Preparation</p>
      <p className="mt-1 text-sm text-muted">
        This is for you, not the Host — nothing here reaches their conversation or Workbook.
        Preparation only reasons from what&rsquo;s already, legitimately on record above.
      </p>

      {turns.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              disabled={sending}
              className="rounded-full border border-rule px-3 py-1.5 text-xs text-ink transition-colors hover:border-seal disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="mt-5 space-y-4">
          {turns.map((t, i) => (
            <div key={i}>
              <p className="label text-muted">{t.role === "guide" ? "You asked" : "Preparation"}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{t.content}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-[#e0857d]">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-5 flex flex-wrap gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Preparation anything about this participant's record…"
          disabled={sending}
          className="min-w-[16rem] flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-sm text-ink outline-none backdrop-blur-sm focus:border-seal"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Asking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
