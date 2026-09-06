"use client";

import { useEffect, useRef, useState } from "react";
import RichText from "@/components/RichText";
import MicButton from "@/components/MicButton";
import SpeakButton from "@/components/SpeakButton";

type Msg = { role: "host" | "guide"; content: string; heard?: boolean };

export default function UnsaidChat({
  conversationId,
  recipient,
  hasGrounding,
  initialMessages,
  endAction,
  deleteAction,
}: {
  conversationId: string;
  recipient: string;
  hasGrounding: boolean;
  initialMessages: Msg[];
  endAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const prevCount = useRef(0);
  const [micStop, setMicStop] = useState(0);

  useEffect(() => {
    if (messages.length > prevCount.current) {
      prevCount.current = messages.length;
      lastRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  async function send(wantsResponse: boolean) {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMicStop((n) => n + 1);
    setError("");
    setSending(true);

    if (!wantsResponse) {
      setMessages((m) => [...m, { role: "host", content: text, heard: true }]);
    } else {
      setMessages((m) => [...m, { role: "host", content: text }, { role: "guide", content: "" }]);
    }

    try {
      const res = await fetch("/api/unsaid/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text, wantsResponse }),
      });
      if (res.headers.get("x-avaia-crisis") === "1") setCrisis(true);
      if (!res.ok) throw new Error("That didn't go through. Please try again.");

      if (!wantsResponse) {
        setSending(false);
        return;
      }

      if (!res.body) throw new Error("No response came back. Please try again.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: "guide", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((m) => m.slice(0, wantsResponse ? -2 : -1));
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

      <div className="space-y-5">
        {messages.map((m, i) => (
          <div
            key={i}
            ref={i === messages.length - 1 ? lastRef : undefined}
            className={m.role === "host" ? "flex flex-col items-end scroll-mt-24" : "scroll-mt-24"}
          >
            {m.role === "host" ? (
              <>
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-white/[0.07] px-4 py-3 text-ink backdrop-blur-sm">
                  {m.content}
                </div>
                {m.heard && <p className="mt-1.5 text-xs italic text-muted">received — no response</p>}
              </>
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

      <div className="mt-8">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            placeholder={`What still needs to be said to ${recipient}?`}
            disabled={sending}
            className="w-full resize-none rounded-lg border border-rule bg-white/[0.04] py-3 pl-4 pr-16 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
          />
          <MicButton value={input} onChange={setInput} disabled={sending} stopSignal={micStop} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => send(false)}
            disabled={sending || !input.trim()}
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? "…" : "Just Say This"}
          </button>
          <button
            type="button"
            onClick={() => send(true)}
            disabled={sending || !input.trim()}
            className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal disabled:opacity-50"
          >
            {sending ? "…" : "Say This, and Ask for Something Back"}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          &ldquo;Just Say This&rdquo; is only received — nothing is generated back.
          {hasGrounding
            ? " If you ask for something back, AVAIA will use what you shared about them to help ground it — offered words, not a claim about what they'd actually say."
            : " If you ask for something back, AVAIA offers words that might meet what you said — not a claim about what they'd actually think or say."}
        </p>
      </div>

      <div className="rule-t mt-10 border-t border-rule pt-6">
        <div className="flex flex-wrap gap-3">
          <form action={endAction}>
            <input type="hidden" name="conversationId" value={conversationId} />
            <button
              type="submit"
              className="rounded-md border border-rule px-4 py-2 font-sans text-xs font-medium text-muted transition-colors hover:border-seal hover:text-ink"
            >
              Start a New Conversation
            </button>
          </form>
          {confirmDelete ? (
            <form action={deleteAction} className="flex items-center gap-2">
              <input type="hidden" name="conversationId" value={conversationId} />
              <span className="text-xs text-muted">Delete this conversation for good?</span>
              <button
                type="submit"
                className="rounded-md border border-[#8f3b34] px-3 py-1.5 font-sans text-xs font-medium text-[#e0857d] hover:bg-[#8f3b34]/10"
              >
                Yes, delete it
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-rule px-3 py-1.5 font-sans text-xs font-medium text-muted hover:text-ink"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-md border border-rule px-4 py-2 font-sans text-xs font-medium text-muted transition-colors hover:border-[#8f3b34] hover:text-[#e0857d]"
            >
              Delete This Conversation
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          This conversation is private to you. It isn&rsquo;t shared with a Guide, family, or
          anyone else, and it stays here unless you delete it.
        </p>
      </div>
    </div>
  );
}
