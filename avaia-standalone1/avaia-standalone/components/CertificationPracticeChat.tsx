"use client";

import { useState } from "react";

type Msg = { role: "candidate" | "host"; content: string };

/**
 * Rehearsal chat for the AI Host practice. Same streaming pattern as the
 * Companion chat. You are the Guide; the AI plays the Host from the Practice
 * Lab's Host Card. It never evaluates, scores or hints, and nothing here counts
 * as evidence: people give feedback on practice.
 */
export default function CertificationPracticeChat({ labKey, scenario }: { labKey: string; scenario: string | null }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError("");
    setSending(true);
    setMessages((m) => [...m, { role: "candidate", content: text }, { role: "host", content: "" }]);
    try {
      const res = await fetch("/api/certification/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, labKey, scenario, message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The practice Host could not respond. Please try again.");
      }
      const newSessionId = res.headers.get("x-avaia-session-id");
      if (newSessionId) setSessionId(newSessionId);
      if (!res.body) throw new Error("The practice Host could not respond. Please try again.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "host", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((m) => m.slice(0, -2));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="space-y-5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "candidate" ? "flex justify-end" : ""}>
            {m.role === "candidate" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-white/[0.07] px-4 py-3 text-ink backdrop-blur-sm">{m.content}</div>
            ) : (
              <div className="max-w-[90%]">
                <p className="label mb-1 text-muted">Host</p>
                <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-ink">
                  {m.content ? m.content : sending && i === messages.length - 1 ? <span className="text-muted">…</span> : null}
                </div>
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && <p className="text-muted">You are the Guide. Begin the way you would begin the conversation. The Host will respond.</p>}
      </div>

      {error && <p className="mt-4 text-sm text-[#e0857d]">{error}</p>}

      <form onSubmit={send} className="mt-8">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={3}
          placeholder="Speak as the Guide…"
          disabled={sending}
          className="w-full resize-none rounded-lg border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          This is rehearsal. The practice Host does not evaluate or score you and gives no feedback; a person at AVAIA does that. Nothing here is
          evidence or part of your record.
        </p>
      </form>
    </div>
  );
}
