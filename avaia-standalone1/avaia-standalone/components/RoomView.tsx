"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Participant = {
  room_participant_id: string;
  participant_id: string;
  name: string;
  developmental_band: string | null;
};

type RoomMessage = {
  id: string;
  role: "participant" | "guide";
  speaker_participant_id: string | null;
  speaker_name: string | null;
  content: string;
  created_at: string;
};

type Room = {
  id: string;
  title: string | null;
  status: "active" | "complete";
  program: string;
};

type RosterEntry = { id: string; name: string };

type RoomReferral = {
  roomTitle: string | null;
  whatWeWereLookingAt: string;
  whatEachPersonMadeVisible: { participantName: string; contribution: string }[];
  whatBecameClearerBetweenThem: string;
  whereTheyStillSeeItDifferently: string[];
  whatWasChosenToCarryForward: string[];
  questionsStillAtTheTable: string[];
};

/** A minimal, self-contained chat panel for private processing -- talks
 *  directly to /api/conversation, the exact same endpoint every ordinary
 *  individual conversation already uses. Deliberately not JourneyChat:
 *  that component assumes a Journey's own stage-completion flow, which
 *  doesn't apply to a private detour opened from inside a Room -- this one
 *  just sends/receives until the participant chooses to return. */
function PrivatePanel({
  conversationId,
  participantName,
  onReturn,
}: {
  conversationId: string;
  participantName: string;
  onReturn: (choice: "keep_private" | "brought_forward", content?: string) => Promise<void>;
}) {
  const [messages, setMessages] = useState<{ role: "host" | "guide"; content: string }[]>([
    { role: "guide", content: "Tell me something about yourself that you would want me to know." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [bringForward, setBringForward] = useState("");
  const [showReturn, setShowReturn] = useState(false);
  const [returning, setReturning] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "host", content: text }]);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no stream");
      const dec = new TextDecoder();
      let acc = "";
      setMessages((m) => [...m, { role: "guide", content: "" }]);
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
    } catch {
      setMessages((m) => [...m, { role: "guide", content: "(Something interrupted the response.)" }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] p-4">
      <p className="label mb-2 text-muted">Private processing — {participantName}</p>
      <p className="mb-3 text-xs text-muted">
        This is protected. Nothing here enters the shared Room unless {participantName} chooses to
        bring it forward.
      </p>
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-rule bg-white/[0.03] p-3">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "host" ? "text-ink" : "text-muted"}>
            <span className="label mr-2">{m.role === "host" ? participantName : "AVAIA"}</span>
            {m.content}
          </p>
        ))}
      </div>
      {!showReturn ? (
        <>
          <div className="mt-3 flex gap-2">
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
            onClick={() => setShowReturn(true)}
            className="mt-3 text-sm text-muted underline hover:text-seal"
          >
            Return to Room
          </button>
        </>
      ) : (
        <div className="mt-3 rounded-md border border-rule bg-white/[0.03] p-3">
          <p className="label mb-2">What comes back to the Room?</p>
          <textarea
            value={bringForward}
            onChange={(e) => setBringForward(e.target.value)}
            placeholder="Optional — write exactly what you want the Room to hear, in your own words. Leave blank to keep this private."
            rows={3}
            className="w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={returning}
              onClick={async () => {
                setReturning(true);
                await onReturn("keep_private");
                setReturning(false);
              }}
              className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              Keep this private
            </button>
            <button
              disabled={returning || !bringForward.trim()}
              onClick={async () => {
                setReturning(true);
                await onReturn("brought_forward", bringForward.trim());
                setReturning(false);
              }}
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

export default function RoomView({
  room,
  initialParticipants,
  initialMessages,
  roster,
  initialReferral,
}: {
  room: Room;
  initialParticipants: Participant[];
  initialMessages: RoomMessage[];
  roster: RosterEntry[];
  initialReferral: RoomReferral | null;
}) {
  const router = useRouter();
  const [participants, setParticipants] = useState(initialParticipants);
  const [messages, setMessages] = useState(initialMessages);
  const [speaker, setSpeaker] = useState(initialParticipants[0]?.participant_id ?? "");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [addPick, setAddPick] = useState("");
  const [openPrivateFor, setOpenPrivateFor] = useState<{ participantId: string; conversationId: string; roomPrivateSessionId: string } | null>(null);
  const [closing, setClosing] = useState(false);
  const [referral, setReferral] = useState(initialReferral);
  const [error, setError] = useState("");

  const notSeated = roster.filter((r) => !participants.some((p) => p.participant_id === r.id));

  async function addParticipant() {
    if (!addPick) return;
    const res = await fetch(`/api/room/${room.id}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: addPick }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not add participant.");
      return;
    }
    const added = roster.find((r) => r.id === addPick);
    if (added) {
      setParticipants((p) => [
        ...p,
        { room_participant_id: crypto.randomUUID(), participant_id: added.id, name: added.name, developmental_band: null },
      ]);
      if (!speaker) setSpeaker(added.id);
    }
    setAddPick("");
  }

  async function removeParticipant(participantId: string) {
    await fetch(`/api/room/${room.id}/participants`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    setParticipants((p) => p.filter((x) => x.participant_id !== participantId));
  }

  async function send() {
    const text = input.trim();
    if (!text || !speaker || sending) return;
    setInput("");
    setSending(true);
    setError("");
    const speakerName = participants.find((p) => p.participant_id === speaker)?.name ?? "Participant";
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "participant", speaker_participant_id: speaker, speaker_name: speakerName, content: text, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`/api/room/${room.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerParticipantId: speaker, message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send.");
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "guide", speaker_participant_id: null, speaker_name: null, content: data.reply, created_at: new Date().toISOString() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function startPrivate(participantId: string) {
    const res = await fetch(`/api/room/${room.id}/private`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not start private processing.");
      return;
    }
    setOpenPrivateFor({
      participantId,
      conversationId: data.conversation.id,
      roomPrivateSessionId: data.roomPrivateSessionId,
    });
  }

  async function handleReturn(choice: "keep_private" | "brought_forward", content?: string) {
    if (!openPrivateFor) return;
    const res = await fetch(`/api/room/${room.id}/private`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomPrivateSessionId: openPrivateFor.roomPrivateSessionId, choice, content }),
    });
    const data = await res.json().catch(() => ({}));
    const name = participants.find((p) => p.participant_id === openPrivateFor.participantId)?.name ?? "Participant";
    if (choice === "brought_forward" && content) {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "participant", speaker_participant_id: openPrivateFor.participantId, speaker_name: name, content, created_at: new Date().toISOString() },
      ]);
      if (data.reply) {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "guide", speaker_participant_id: null, speaker_name: null, content: data.reply, created_at: new Date().toISOString() },
        ]);
      }
    }
    setOpenPrivateFor(null);
  }

  async function closeRoom() {
    setClosing(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${room.id}/close`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not close the Room.");
      setReferral(data.content);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div>
      {/* Table roster */}
      <section className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-3 text-muted">Who Is Seated at This Table</p>
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <span
              key={p.participant_id}
              className="inline-flex items-center gap-2 rounded-full border border-rule bg-white/[0.04] px-3 py-1.5 text-sm text-ink"
            >
              {p.name}
              {p.developmental_band && <span className="text-xs text-muted">({p.developmental_band})</span>}
              {room.status === "active" && (
                <button
                  onClick={() => removeParticipant(p.participant_id)}
                  className="text-muted hover:text-seal"
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {room.status === "active" && notSeated.length > 0 && (
          <div className="mt-3 flex gap-2">
            <select
              value={addPick}
              onChange={(e) => setAddPick(e.target.value)}
              className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
            >
              <option value="">Invite to the Table…</option>
              {notSeated.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={addParticipant}
              disabled={!addPick}
              className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
      </section>

      {error && <p className="mt-4 text-sm text-[#e0857d]">{error}</p>}

      {/* Shared thread */}
      <section className="mt-8">
        <p className="label mb-3 text-muted">The Room</p>
        <div className="space-y-4 rounded-lg border border-rule bg-white/[0.03] p-5">
          {messages.length === 0 && <p className="text-muted">Nothing has been said in this Room yet.</p>}
          {messages.map((m) => (
            <div key={m.id}>
              <p className="label mb-1 text-muted">{m.role === "guide" ? "AVAIA" : m.speaker_name ?? "Participant"}</p>
              <p className="whitespace-pre-wrap text-ink">{m.content}</p>
            </div>
          ))}
        </div>

        {room.status === "active" && participants.length > 0 && (
          <div className="mt-4 rounded-lg border border-rule bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="label text-muted" htmlFor="speaker">
                Speaking as
              </label>
              <select
                id="speaker"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
              >
                {participants.map((p) => (
                  <option key={p.participant_id} value={p.participant_id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => speaker && startPrivate(speaker)}
                className="ml-auto rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-muted hover:border-seal hover:text-ink"
              >
                Start private processing for {participants.find((p) => p.participant_id === speaker)?.name}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                placeholder="What would this person say to the Table?"
                className="flex-1 rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="rounded-md bg-seal px-5 py-2 font-sans text-sm font-semibold text-[#05060b] disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}

        {openPrivateFor && (
          <PrivatePanel
            conversationId={openPrivateFor.conversationId}
            participantName={participants.find((p) => p.participant_id === openPrivateFor.participantId)?.name ?? "Participant"}
            onReturn={handleReturn}
          />
        )}
      </section>

      {/* Close / continuity */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        {room.status === "active" ? (
          <>
            <p className="label mb-3 text-muted">Close This Room</p>
            <p className="text-muted">
              Generates the Room&rsquo;s own closing record from the shared conversation above.
              Nothing any participant kept private is included.
            </p>
            <button
              onClick={closeRoom}
              disabled={closing || messages.length === 0}
              className="mt-3 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              {closing ? "Closing…" : "Close Room"}
            </button>
          </>
        ) : referral ? (
          <>
            <p className="label mb-3 text-muted">What Became Visible in This Room</p>
            <div className="space-y-5">
              <div>
                <p className="font-serif text-lg text-ink">What We Were Looking At</p>
                <p className="mt-1 text-muted">{referral.whatWeWereLookingAt}</p>
              </div>
              <div>
                <p className="font-serif text-lg text-ink">What Each Person Made Visible</p>
                <ul className="mt-1 space-y-2">
                  {referral.whatEachPersonMadeVisible.map((item, i) => (
                    <li key={i}>
                      <span className="text-ink">{item.participantName}: </span>
                      <span className="text-muted">{item.contribution}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-serif text-lg text-ink">What Became Clearer Between Them</p>
                <p className="mt-1 text-muted">{referral.whatBecameClearerBetweenThem}</p>
              </div>
              {referral.whereTheyStillSeeItDifferently.length > 0 && (
                <div>
                  <p className="font-serif text-lg text-ink">Where They Still See It Differently</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {referral.whereTheyStillSeeItDifferently.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {referral.whatWasChosenToCarryForward.length > 0 && (
                <div>
                  <p className="font-serif text-lg text-ink">What Was Chosen to Carry Forward</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {referral.whatWasChosenToCarryForward.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {referral.questionsStillAtTheTable.length > 0 && (
                <div>
                  <p className="font-serif text-lg text-ink">Questions Still at the Table</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {referral.questionsStillAtTheTable.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted">This Room is closed.</p>
        )}
      </section>
    </div>
  );
}
