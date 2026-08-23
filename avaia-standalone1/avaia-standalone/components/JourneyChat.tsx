"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MicButton from "@/components/MicButton";
import SpeakButton from "@/components/SpeakButton";
import RichText from "@/components/RichText";
import { extractFocus, resolveFocus, type ResolvedFocus } from "@/lib/virtue-focus";
// Type-only -- referral-provenance.ts is "server-only", but a type-only
// import is fully erased before bundling, so nothing server-only actually
// ships to the client. Reused so the card's shape can't drift from what
// getCompletionSummary() actually returns.
import type { CompletionSummary } from "@/lib/engine/referral-provenance";
// Type-only, same reasoning as CompletionSummary above -- prompts.ts is
// also "server-only"; this import is fully erased before bundling.
import type { Program } from "@/lib/engine/prompts";

type Msg = { role: "host" | "guide"; content: string };

export default function JourneyChat({
  conversationId,
  stageLabel,
  nextStageLabel,
  isLast,
  initialMessages,
  program = "general",
}: {
  conversationId: string;
  stageLabel: string;
  /** What this stage's referral goes to -- the next stage's own label, or
   *  "Continuity" for InnerCompass. Resolved server-side (STAGE_LABEL is
   *  server-only) and passed down as a plain string purely for the
   *  completion card's heading below; not used for anything else. */
  nextStageLabel?: string;
  isLast: boolean;
  initialMessages: Msg[];
  /** Which program this conversation belongs to — decides where finishing
   *  the whole journey lands the Host (general Workbook vs. the Defying
   *  Grief dashboard; a Youth conversation falls through to Workbook,
   *  same as general, since there's no Youth dashboard yet). Defaults to
   *  "general" for every existing caller. */
  program?: Program;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState("");
  // Set once the referral has been generated, from either the button or a
  // typed completion request -- both converge on the same
  // generateReferral() result and the same compact completion card below.
  // Navigation waits for the Host's own "Continue" click. summary is a
  // handful of fields selected from the already-stored referral
  // (getCompletionSummary, server-side) -- not the full referral, which
  // now lives only in Workbook's Guide's Record.
  const [finished, setFinished] = useState<{ done: boolean; summary: CompletionSummary } | null>(
    null
  );
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
      if (!res.ok) throw new Error("The Guide could not respond. Please try again.");
      if (res.headers.get("x-avaia-crisis") === "1") setCrisis(true);

      // The Host typed readiness to finish directly into the chat instead of
      // clicking the button below — the server already generated the
      // referral (see isFinishIntent in lib/engine/finish-intent.ts). Drop
      // the empty guide placeholder (no full-text reply follows anymore --
      // the compact completion card below replaces it) and wait for the
      // Host's own "Continue" click rather than reading a body that isn't
      // a stream and navigating immediately.
      if (res.headers.get("x-avaia-finished") === "1") {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => m.slice(0, -1));
        setFinished({ done: !!data.done, summary: data.summary || {} });
        return;
      }

      if (!res.body) throw new Error("The Guide could not respond. Please try again.");
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
      // Wait for the Host's own "Continue" click, the same as a typed
      // completion request in send() above -- both paths call the same
      // generateReferral() and produce the same compact completion card.
      setFinished({ done: !!data.done, summary: data.summary || {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdvancing(false);
    }
  }

  function continueForward() {
    if (!finished) return;
    if (finished.done) router.push(program === "defying-grief" ? "/defying-grief" : "/workbook");
    else router.refresh(); // the next stage's conversation loads
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

      {finished ? (
        <div className="mt-10">
          {/* A visual break before the completion card, not a chat bubble.
              The card below shows a handful of fields already selected
              from the stored referral (getCompletionSummary) -- not the
              full referral, which is not persisted as a chat message
              anymore and lives only in Workbook's Guide's Record. */}
          <div className="h-px bg-rule" aria-hidden />

          <div className="mt-5 rounded-lg border border-seal/40 bg-seal/[0.06] p-5 backdrop-blur-sm">
            <p className="label text-seal">Conversation Complete</p>
            <p className="mt-1 font-serif text-2xl text-ink">{stageLabel}</p>

            {finished.summary.outcomeLabel && (
              <p className="mt-3 text-sm text-ink">
                <span className="text-muted">Outcome: </span>
                {finished.summary.outcomeLabel}
              </p>
            )}
            {finished.summary.roomIdentity && (
              <p className="mt-2 font-serif text-lg italic leading-relaxed text-ink">
                &ldquo;{finished.summary.roomIdentity}&rdquo;
              </p>
            )}
            {finished.summary.direction && (
              <p className="mt-2 text-sm leading-relaxed text-ink">{finished.summary.direction}</p>
            )}

            <p className="mt-4 text-sm text-muted">
              Your Guide&rsquo;s Record has been updated with what became visible in this
              conversation.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!finished.done && (
                <Link
                  href="/workbook"
                  className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                >
                  View Guide&rsquo;s Record
                </Link>
              )}
              <button
                type="button"
                onClick={continueForward}
                className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
              >
                {finished.done
                  ? "View Guide's Record"
                  : `Continue to ${nextStageLabel ?? "the next stage"}`}
              </button>
            </div>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
