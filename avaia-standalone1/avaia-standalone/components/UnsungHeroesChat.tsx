"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RichText from "@/components/RichText";
import { extractFocus, resolveFocus, type ResolvedFocus } from "@/lib/virtue-focus";

type Msg = { role: "host" | "guide"; content: string };
type ContextType = "school" | "community" | "family";

export default function UnsungHeroesChat({
  conversationId,
  pathLabel,
  initialMessages,
}: {
  conversationId: string;
  pathLabel: string;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [error, setError] = useState("");
  const lastHostRef = useRef<HTMLDivElement | null>(null);
  const prevHostCount = useRef(0);
  const [focus, setFocus] = useState<ResolvedFocus | null>(null);
  const lastFocusKeyRef = useRef("");

  const [showCardForm, setShowCardForm] = useState(false);
  const [contextType, setContextType] = useState<ContextType>("school");
  const [school, setSchool] = useState("");
  const [teacher, setTeacher] = useState("");
  const [grade, setGrade] = useState("");
  const [business, setBusiness] = useState("");
  const [organization, setOrganization] = useState("");
  const [eventName, setEventName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{
    observedName: string;
    virtueFamily: string;
    virtueName: string | null;
  } | null>(null);

  useEffect(() => {
    const hostCount = messages.reduce((n, m) => n + (m.role === "host" ? 1 : 0), 0);
    if (hostCount > prevHostCount.current) {
      prevHostCount.current = hostCount;
      lastHostRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [messages]);

  function broadcastFocus(f: ResolvedFocus | null) {
    const key = f ? `${f.familyKey}|${f.virtueName ?? ""}` : "";
    if (key === lastFocusKeyRef.current) return;
    lastFocusKeyRef.current = key;
    setFocus(f);
    window.dispatchEvent(new CustomEvent("avaia:focus", { detail: f }));
  }

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("avaia:focus", { detail: null }));
    };
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError("");
    setSending(true);
    broadcastFocus(null);
    setMessages((m) => [...m, { role: "host", content: text }, { role: "guide", content: "" }]);
    try {
      const res = await fetch("/api/unsung-heroes/message", {
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
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/unsung-heroes/recognition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          contextType,
          context:
            contextType === "school"
              ? { school, teacher, grade }
              : contextType === "community"
                ? { business, organization, event: eventName }
                : {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the recognition.");
      setSaved({
        observedName: data.recognition.observed_name,
        virtueFamily: data.recognition.virtue_family,
        virtueName: data.recognition.virtue_name,
      });
      setShowCardForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  let lastHostIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "host") {
      lastHostIdx = i;
      break;
    }
  }

  if (saved) {
    return (
      <div className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-6">
        <p className="label text-seal">Recognition saved</p>
        <h2 className="mt-2 font-serif text-2xl text-ink">
          {saved.virtueName ? `${saved.virtueName} · ` : ""}
          {saved.virtueFamily}
        </h2>
        <p className="mt-2 text-ink">
          You recognized <strong>{saved.observedName}</strong>. It&rsquo;s saved to the record.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/unsung-heroes"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Recognize someone else
          </a>
          <a
            href="/unsung-heroes/dashboard"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            View dashboard
          </a>
        </div>
      </div>
    );
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
            className={m.role === "host" ? "flex justify-end scroll-mt-24" : "scroll-mt-24"}
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

      {showCardForm ? (
        <form onSubmit={saveCard} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="font-serif text-lg text-ink">A few details for the card</p>
          <p className="mt-1 text-sm text-muted">
            Who sees this card follows automatically from this context — not something you choose.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["school", "community", "family"] as ContextType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContextType(t)}
                className={
                  "rounded-full border px-4 py-1.5 text-sm capitalize transition-colors " +
                  (contextType === t
                    ? "border-seal bg-seal/10 text-seal"
                    : "border-rule text-muted hover:border-seal")
                }
              >
                {t}
              </button>
            ))}
          </div>

          {contextType === "school" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="School"
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
              />
              <input
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="Teacher"
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
              />
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Grade"
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
              />
            </div>
          )}

          {contextType === "community" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="Business"
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
              />
              <input
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Organization"
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
              />
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event"
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-seal"
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save recognition"}
            </button>
            <button
              type="button"
              onClick={() => setShowCardForm(false)}
              disabled={saving}
              className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-muted transition-colors hover:border-seal hover:text-ink disabled:opacity-50"
            >
              Back to conversation
            </button>
          </div>
        </form>
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
              placeholder="Write as much or as little as you like…"
              disabled={sending}
              className="w-full resize-none rounded-lg border border-rule bg-white/[0.04] py-3 px-4 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {sending ? "…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setShowCardForm(true)}
              disabled={sending}
              className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-muted transition-colors hover:border-seal hover:text-ink disabled:opacity-50"
            >
              Create recognition card
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">
            {pathLabel}. This conversation is saved so the recognition can be created whenever
            you&rsquo;re ready.
          </p>
        </form>
      )}
    </div>
  );
}
