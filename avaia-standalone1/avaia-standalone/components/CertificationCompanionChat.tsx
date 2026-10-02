"use client";

import { useState } from "react";
import RichText from "@/components/RichText";

type Msg = { role: "candidate" | "companion"; content: string };

/**
 * Purpose-built, not an adaptation of JourneyChat -- JourneyChat carries
 * finish-intent/referral/focus-tracking machinery specific to the IAP/CAT/
 * InnerCompass journey engine that has no equivalent here. This borrows
 * JourneyChat's visual language (bubble shapes, seal/ink/muted tokens,
 * the streaming-fetch pattern) at the smallest version's scope: no voice
 * input, no virtue-focus highlighting, no finish/referral flow.
 */
export default function CertificationCompanionChat({
  initialMessages,
  initialConversationId,
}: {
  initialMessages: Msg[];
  initialConversationId: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError("");
    setEscalated(false);
    setSending(true);
    setMessages((m) => [...m, { role: "candidate", content: text }, { role: "companion", content: "" }]);
    try {
      const res = await fetch("/api/certification/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "The Companion could not respond. Please try again.");
      }
      if (res.headers.get("x-avaia-crisis") === "1") setCrisis(true);
      if (res.headers.get("x-avaia-escalated") === "1") setEscalated(true);
      const newConvoId = res.headers.get("x-avaia-conversation-id");
      if (newConvoId) setConversationId(newConvoId);

      if (!res.body) throw new Error("The Companion could not respond. Please try again.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "companion", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8">
      {crisis && (
        <div className="mb-6 rounded-lg border border-[#8f3b34] bg-[#2a1512]/60 px-5 py-4 backdrop-blur-sm">
          <p className="font-serif text-lg text-[#e0a59d]">You don&rsquo;t have to hold this alone</p>
          <p className="mt-1 text-sm text-ink">
            If you may be in danger or thinking of harming yourself or someone else, please reach
            out now: call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline), call{" "}
            <strong>911</strong> for immediate danger, or text <strong>HOME</strong> to{" "}
            <strong>741741</strong>.
          </p>
        </div>
      )}
      {escalated && !crisis && (
        <div className="mb-6 rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
          <p className="text-sm text-ink">
            This has been flagged for a person to follow up on with you directly.
          </p>
        </div>
      )}

      <div className="space-y-5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "candidate" ? "flex justify-end" : ""}>
            {m.role === "candidate" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-white/[0.07] px-4 py-3 text-ink backdrop-blur-sm">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[90%]">
                <div className="font-serif text-lg leading-relaxed text-ink">
                  {m.content ? (
                    <RichText text={m.content} />
                  ) : sending && i === messages.length - 1 ? (
                    <span className="text-muted">…</span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-muted">
            Ask about any lesson or Practice Lab, or just say where you&rsquo;d like to pick back up.
          </p>
        )}
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
          placeholder="Ask about a lesson, a Practice Lab, or where you left off…"
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
          The Companion answers from approved AVAIA certification material only, and never makes or
          implies a certification decision. If you have a question only a person can answer, it will
          flag that for a person to follow up with you.
        </p>
      </form>
    </div>
  );
}
