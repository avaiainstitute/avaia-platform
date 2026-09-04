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

type PendingPrivate = { participantId: string; participantName: string; accessUrl: string };

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
  const [pendingPrivate, setPendingPrivate] = useState<PendingPrivate[]>([]);
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  /** Starts private processing and receives back only a one-time access
   *  URL -- never the conversation itself. This Room view has no way to
   *  read what happens at that link; it exists only to be copied and
   *  handed to the participant. */
  async function startPrivate(participantId: string) {
    setError("");
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
    const name = participants.find((p) => p.participant_id === participantId)?.name ?? "Participant";
    setPendingPrivate((p) => [...p, { participantId, participantName: name, accessUrl: data.accessUrl }]);
  }

  async function copyLink(url: string, participantId: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFor(participantId);
      setTimeout(() => setCopiedFor(null), 2000);
    } catch {
      /* clipboard unavailable — link is still shown on screen to copy manually */
    }
  }

  /** Re-fetches the Room's shared thread from the server -- the only way
   *  this view learns that a participant brought something back, since
   *  that write happens through the participant's own session, not this
   *  browser. No polling; the Guide checks when it's time to check. */
  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/room/${room.id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages(data.messages ?? messages);
        setParticipants(data.participants ?? participants);
        const stillPending = new Set((data.activePrivateSessions ?? []).map((s: { participant_id: string }) => s.participant_id));
        setPendingPrivate((p) => p.filter((x) => stillPending.has(x.participantId)));
      }
    } finally {
      setRefreshing(false);
    }
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
        <div className="flex items-baseline justify-between">
          <p className="label text-muted">The Room</p>
          <button onClick={refresh} disabled={refreshing} className="text-xs text-muted underline hover:text-seal disabled:opacity-50">
            {refreshing ? "Checking…" : "Check for updates"}
          </button>
        </div>
        <div className="mt-3 space-y-4 rounded-lg border border-rule bg-white/[0.03] p-5">
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

        {/* Pending private-processing links -- shown only to be handed over.
            This view has no way to see what happens once one is opened;
            "Check for updates" above is the only way anything from it can
            appear back in the Room, and only if the participant chooses
            to bring something forward themselves. */}
        {pendingPrivate.map((pp) => (
          <div key={pp.participantId} className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] p-4">
            <p className="label mb-1 text-muted">Private processing — {pp.participantName}</p>
            <p className="mb-3 text-sm text-muted">
              Hand this link to {pp.participantName} to open on their own device, or in a private/
              incognito window — not in this tab. This view cannot see what happens there.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-xs text-ink">
                {pp.accessUrl}
              </code>
              <button
                onClick={() => copyLink(pp.accessUrl, pp.participantId)}
                className="rounded-md border border-rule px-3 py-2 text-xs font-medium text-ink hover:border-seal"
              >
                {copiedFor === pp.participantId ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        ))}
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
