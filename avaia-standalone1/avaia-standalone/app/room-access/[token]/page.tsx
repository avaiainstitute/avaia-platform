"use client";

import { useEffect, useState } from "react";
import { createParticipantClient } from "@/lib/supabase/participant-client";

type Phase = "loading" | "error" | "chatting" | "choosing-return" | "done";

/** The participant's own private-processing page -- opened from a one-time
 *  link the Guide hands over, never from the Guide's own signed-in tab.
 *  Everything here runs on an isolated Supabase client
 *  (lib/supabase/participant-client.ts) whose session lives in its own
 *  localStorage key, not the cookie session the rest of the app uses --
 *  opening this in a second tab of the same browser the Guide is signed
 *  into does not touch or replace the Guide's own session.
 *
 *  This page never calls the ordinary /api/conversation route (cookie-
 *  authenticated); it calls /api/room-access/message and
 *  /api/room-access/return with this session's own bearer token instead.
 *  The Guide's account has no code path back into anything that happens
 *  on this page. */
export default function RoomAccessPage({ params }: { params: { token: string } }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [roomPrivateSessionId, setRoomPrivateSessionId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [messages, setMessages] = useState<{ role: "host" | "guide"; content: string }[]>([
    { role: "guide", content: "Tell me something about yourself that you would want me to know." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [bringForward, setBringForward] = useState("");
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/room-access/consume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: params.token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "This link isn't valid.");
          setPhase("error");
          return;
        }
        const supabase = createParticipantClient();
        const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: "magiclink",
        });
        if (verifyError || !verified.session) {
          setError("This link couldn't be opened. Please ask your Guide for a new one.");
          setPhase("error");
          return;
        }
        setAccessToken(verified.session.access_token);
        setConversationId(data.conversationId);
        setRoomPrivateSessionId(data.roomPrivateSessionId);
        setRoomTitle(data.roomTitle);
        setPhase("chatting");
      } catch {
        setError("Something went wrong opening this link.");
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "host", content: text }]);
    try {
      const res = await fetch("/api/room-access/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((m) => [...m, { role: "guide", content: data.reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "guide", content: e instanceof Error ? e.message : "Something interrupted the response." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function submitReturn(choice: "keep_private" | "brought_forward") {
    setReturning(true);
    try {
      await fetch("/api/room-access/return", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          roomPrivateSessionId,
          choice,
          content: choice === "brought_forward" ? bringForward.trim() : undefined,
        }),
      });
      setPhase("done");
    } catch {
      setError("Could not return to the Room. You can try again, or tell your Guide directly.");
    } finally {
      setReturning(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-prose px-5 py-24 text-center">
        <p className="label mb-3">One moment</p>
        <h1 className="font-serif text-2xl text-ink">Opening your private space…</h1>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-prose px-5 py-24 text-center">
        <h1 className="font-serif text-2xl text-ink">That link didn&rsquo;t work</h1>
        <p className="mt-4 text-muted">{error}</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-prose px-5 py-24 text-center">
        <h1 className="font-serif text-2xl text-ink">You&rsquo;re all set.</h1>
        <p className="mt-4 text-muted">
          You can close this tab now and return to your Guide. Only what you chose to bring forward
          — if anything — is visible in the Room.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-12">
      <p className="label mb-2 text-muted">Private space{roomTitle ? ` — ${roomTitle}` : ""}</p>
      <h1 className="font-serif text-2xl text-ink">This is just between you and AVAIA.</h1>
      <p className="mt-2 text-sm text-muted">
        Nothing here is visible to your Guide or anyone else in the Room unless you choose to bring
        it forward yourself.
      </p>

      <div className="mt-6 max-h-96 space-y-4 overflow-y-auto rounded-lg border border-rule bg-white/[0.03] p-4">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "host" ? "text-ink" : "text-muted"}>
            <span className="label mr-2">{m.role === "host" ? "You" : "AVAIA"}</span>
            {m.content}
          </p>
        ))}
      </div>

      {phase === "chatting" && (
        <>
          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending}
              placeholder="Type here..."
              className="flex-1 rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
            />
            <button
              onClick={send}
              disabled={sending}
              className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <button
            onClick={() => setPhase("choosing-return")}
            className="mt-4 text-sm text-muted underline hover:text-seal"
          >
            Return to the Room
          </button>
        </>
      )}

      {phase === "choosing-return" && (
        <div className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] p-4">
          <p className="label mb-2">What comes back to the Room?</p>
          <p className="mb-3 text-sm text-muted">
            Nothing here returns automatically. Leave this blank to keep it all private.
          </p>
          <textarea
            value={bringForward}
            onChange={(e) => setBringForward(e.target.value)}
            placeholder="Write exactly what you want the Room to hear, in your own words."
            rows={3}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
          />
          <div className="mt-3 flex gap-2">
            <button
              disabled={returning}
              onClick={() => submitReturn("keep_private")}
              className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              Keep it all private
            </button>
            <button
              disabled={returning || !bringForward.trim()}
              onClick={() => submitReturn("brought_forward")}
              className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] disabled:opacity-50"
            >
              Bring this into the Room
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
