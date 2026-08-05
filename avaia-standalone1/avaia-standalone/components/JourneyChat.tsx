"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MicButton from "@/components/MicButton";
import SpeakButton from "@/components/SpeakButton";
import RichText from "@/components/RichText";
import { extractFocus, resolveFocus, type ResolvedFocus } from "@/lib/virtue-focus";

type Msg = { role: "host" | "guide"; content: string };

export default function JourneyChat({
  conversationId,
  stageLabel,
  isLast,
  initialMessages,
  program = "general",
}: {
  conversationId: string;
  stageLabel: string;
  isLast: boolean;
  initialMessages: Msg[];
  /** Which program this conversation belongs to — decides where finishing
   *  the whole journey lands the Host (general Workbook vs. the Defying
   *  Grief dashboard). Defaults to "general" for every existing caller. */
  program?: "general" | "defying-grief";
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState("");
  const lastHostRef = useRef<HTMLDivElement | null>(null);
  const prevHostCount = useRef(0);
  const [focus, setFocus] = useState<ResolvedFocus | null>(null);
  const lastFocusKeyRef = useRef("");
  // Bumped on send so dictation stops and can't re-fill the cleared input.
  const [micStop, setMicStop] = useState(0);

  // When the Host sends a new message, bring that message to the top of the
  // viewport so the Guide's reply streams in right below it — fully readable —
  // instead of the page jumping to the very bottom on every streamed token.
  useEffect(() => {
    const hostCount = messages.reduce(
      (n, m) => n + (m.role === "host" ? 1 : 0),
      0
    );
    if (hostCount > prevHostCount.current) {
      prevHostCount.current = hostCount;
      lastHostRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  // Broadcast the virtue the Guide has surfaced so the background table can
  // light up its family and outline the specific virtue. De-duped so it fires
  // on change, not on every streamed token.
  function broadcastFocus(f: ResolvedFocus | null) {
    const key = f ? `${f.familyKey}|${f.virtueName ?? ""}` : "";
    if (key === lastFocusKeyRef.current) return;
    lastFocusKeyRef.current = key;
    setFocus(f);
    window.dispatchEvent(new CustomEvent("avaia:focus", { detail: f }));
    // Persist so the Chemistry of Virtue tab opens with the same virtue
    // highlighted if the Host flips over to it.
    try {
      if (f) sessionStorage.setItem("avaia:focus", JSON.stringify(f));
      else sessionStorage.removeItem("avaia:focus");
    } catch {
      /* storage unavailable — highlighting still works in-session */
    }
  }

  // Clear any highlight when the Host leaves the conversation.
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("avaia:focus", { detail: null }));
    };
  }, []);

  async function send(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMicStop((n) => n + 1);
    setError("");
    setSending(true);
    broadcastFocus(null);
    setMessages((m) => [...m, { role: "host", content: text }, { role: "guide", content: "" }]);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error("The Guide could not respond. Please try again.");
      if (res.headers.get("x-avaia-crisis") === "1") setCrisis(true);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const { text: shown, focus: f } = extractFocus(acc);
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "guide", content: shown };
          return copy;
        });
        broadcastFocus(resolveFocus(f));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((m) => m.slice(0, -1)); // drop the empty guide placeholder
    } finally {
      setSending(false);
    }
  }

  async function moveForward() {
    if (advancing || sending) return;
    setAdvancing(true);
    setError("");
    broadcastFocus(null);
    try {
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not move forward.");
      if (data.done) router.push(program === "defying-grief" ? "/defying-grief" : "/workbook");
      else router.refresh(); // the next stage's conversation loads
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setAdvancing(false);
    }
  }

  // Index of the most recent Host message — the scroll anchor for a new turn.
  let lastHostIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "host") {
      lastHostIdx = i;
      break;
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

      <div className="space-y-5">
        {messages.map((m, i) => (
          <div
            key={i}
            ref={i === lastHostIdx ? lastHostRef : undefined}
            className={
              m.role === "host" ? "flex justify-end scroll-mt-24" : "scroll-mt-24"
            }
          >
            {m.role === "host" ? (
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
                {i === messages.length - 1 && !sending && m.content && (
                  <div className="mt-1.5">
                    <SpeakButton text={m.content} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-[#e0857d]">{error}</p>}

      {focus && (
        <div className="mt-5 flex items-center gap-2 text-xs text-muted">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: focus.color }}
            aria-hidden
          />
          <span>
            <span style={{ color: focus.color }}>{focus.familyName}</span>
            {focus.virtueName ? <span> · {focus.virtueName}</span> : null}
          </span>
        </div>
      )}

      <form onSubmit={send} className="mt-8">
        <div className="relative">
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
            placeholder="Write or speak — as much or as little as you like…"
            disabled={sending || advancing}
            className="w-full resize-none rounded-lg border border-rule bg-white/[0.04] py-3 pl-4 pr-16 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <MicButton
            value={input}
            onChange={setInput}
            disabled={sending || advancing}
            stopSignal={micStop}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={sending || advancing || !input.trim()}
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
          <button
            type="button"
            onClick={moveForward}
            disabled={sending || advancing}
            className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-muted transition-colors hover:border-seal hover:text-ink disabled:opacity-50"
          >
            {advancing
              ? "Preparing your referral…"
              : isLast
                ? "I'm ready to finish"
                : "I'm ready to move forward"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          {stageLabel}. This conversation — and the referral prepared when you move forward — is
          saved to your Workbook. AVAIA is not therapy or crisis care — if you&rsquo;re in crisis,
          call or text 988 (U.S.).
        </p>
      </form>
    </div>
  );
}
