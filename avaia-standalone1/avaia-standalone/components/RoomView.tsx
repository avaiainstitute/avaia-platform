"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  status: "active" | "paused" | "complete" | "archived";
  program: string;
  floor_participant_id: string | null;
};

type RosterEntry = { id: string; name: string };

type TurnRequest = {
  id: string;
  participant_id: string;
  name: string;
  status: "pending" | "recognized" | "withdrawn";
  requested_at: string;
};

// The Room's own curated Shared Workbook, "OURS", not the Guide's or any
// Host's personal Workbook (which lives entirely at /workbook and is
// untouched by anything here). See lib/engine/room.ts's own comment.
type WorkbookItem = {
  id: string;
  content: string;
  speakerName: string | null;
  source: "room_message" | "note" | "private_share";
  addedByName: string;
  createdAt: string;
  sourceRoomMessageId: string | null;
};

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
  initialPendingTurnRequests,
  initialWorkbookItems,
}: {
  room: Room;
  initialParticipants: Participant[];
  initialMessages: RoomMessage[];
  roster: RosterEntry[];
  initialReferral: RoomReferral | null;
  initialPendingTurnRequests: TurnRequest[];
  initialWorkbookItems: WorkbookItem[];
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
  const [floorParticipantId, setFloorParticipantId] = useState(room.floor_participant_id);
  const [pendingTurnRequests, setPendingTurnRequests] = useState(initialPendingTurnRequests);
  const [inviteLinks, setInviteLinks] = useState<Record<string, string>>({});
  const [copiedInviteFor, setCopiedInviteFor] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [workbookItems, setWorkbookItems] = useState(initialWorkbookItems);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const notSeated = roster.filter((r) => !participants.some((p) => p.participant_id === r.id));
  const savedMessageIds = new Set(
    workbookItems.map((w) => w.sourceRoomMessageId).filter((id): id is string => !!id)
  );

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
   *  URL, never the conversation itself. This Room view has no way to
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
      /* clipboard unavailable, link is still shown on screen to copy manually */
    }
  }

  /** Re-fetches the Room's shared thread from the server, the only way
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
        setPendingTurnRequests(data.pendingTurnRequests ?? pendingTurnRequests);
        setFloorParticipantId(data.room?.floor_participant_id ?? floorParticipantId);
        const stillPending = new Set((data.activePrivateSessions ?? []).map((s: { participant_id: string }) => s.participant_id));
        setPendingPrivate((p) => p.filter((x) => stillPending.has(x.participantId)));
      }
      await refreshWorkbook();
    } finally {
      setRefreshing(false);
    }
  }

  /** Generates (or reuses) this participant's durable Room-join link, the
   *  "normal flow" invitation from Part A. Unlike startPrivate's one-time
   *  link, this one keeps working for repeat visits until revoked. */
  async function getInvite(participantId: string) {
    setError("");
    const res = await fetch(`/api/room/${room.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Could not create an invitation.");
      return;
    }
    setInviteLinks((links) => ({ ...links, [participantId]: data.inviteUrl }));
  }

  async function copyInvite(url: string, participantId: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteFor(participantId);
      setTimeout(() => setCopiedInviteFor(null), 2000);
    } catch {
      /* clipboard unavailable, link is still shown on screen to copy manually */
    }
  }

  /** Recognizes one raised hand, setting the visible floor. Not a lock,
   *  see lib/engine/room.ts's recognizeTurn: every seated participant can
   *  still post, this only changes who the Room sees as speaking. */
  async function recognize(requestId: string, participantId: string) {
    const res = await fetch(`/api/room/${room.id}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (res.ok) {
      setPendingTurnRequests((r) => r.filter((x) => x.id !== requestId));
      setFloorParticipantId(participantId);
    }
  }

  async function clearFloorNow() {
    const res = await fetch(`/api/room/${room.id}/turn`, { method: "DELETE" });
    if (res.ok) setFloorParticipantId(null);
  }

  /** Explicitly keeps one shared-thread message in the Room's own Shared
   *  Workbook. Never automatic, see this file's own Shared Workbook
   *  section comment. */
  async function saveMessageToWorkbook(messageId: string) {
    setSavingMessageId(messageId);
    setError("");
    try {
      const res = await fetch(`/api/room/${room.id}/workbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_message", messageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save that to the Shared Workbook.");
      await refreshWorkbook();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSavingMessageId(null);
    }
  }

  async function addNote() {
    const content = noteInput.trim();
    if (!content) return;
    setAddingNote(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${room.id}/workbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_note", content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add that note.");
      setNoteInput("");
      await refreshWorkbook();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAddingNote(false);
    }
  }

  async function refreshWorkbook() {
    const res = await fetch(`/api/room/${room.id}/workbook`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setWorkbookItems(data.items ?? workbookItems);
  }

  /** Pause/reopen/archive/unarchive, all reversible. Uses router.refresh()
   *  the same way closeRoom already does, so this component's status-
   *  dependent rendering (which reads the room prop directly, same as
   *  before this Part 1 change) picks up the new status from the server. */
  async function changeStatus(action: "pause" | "reopen" | "archive" | "unarchive") {
    setStatusBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${room.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not change this Room's status.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setStatusBusy(false);
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
              {floorParticipantId === p.participant_id && (
                <span className="text-xs text-seal" title="Has the floor">●</span>
              )}
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

        {/* Each seated participant's own way into the Room, from their own
            device, no screen-sharing, no Guide typing for them. Durable,
            not one-time, see getOrCreateRoomInvitation. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {participants.map((p) => (
            <div key={p.participant_id} className="flex items-center gap-2">
              {!inviteLinks[p.participant_id] ? (
                <button
                  onClick={() => getInvite(p.participant_id)}
                  className="rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-muted hover:border-seal hover:text-ink"
                >
                  Get {p.name}&rsquo;s invitation to the Room
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-rule bg-white/[0.04] px-2 py-1">
                  <code className="max-w-[16rem] truncate text-xs text-ink">{inviteLinks[p.participant_id]}</code>
                  <button
                    onClick={() => copyInvite(inviteLinks[p.participant_id], p.participant_id)}
                    className="text-xs font-medium text-muted hover:text-seal"
                  >
                    {copiedInviteFor === p.participant_id ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {pendingTurnRequests.length > 0 && (
          <div className="mt-4 rounded-md border border-seal/40 bg-seal/[0.06] p-3">
            <p className="label mb-2 text-muted">Waiting to Speak</p>
            <div className="flex flex-wrap gap-2">
              {pendingTurnRequests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => recognize(r.id, r.participant_id)}
                  className="rounded-full border border-rule bg-white/[0.04] px-3 py-1 text-xs text-ink hover:border-seal"
                >
                  Recognize {r.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {floorParticipantId && (
          <p className="mt-3 text-xs text-muted">
            The floor is with {participants.find((p) => p.participant_id === floorParticipantId)?.name ?? "a participant"}.{" "}
            <button onClick={clearFloorNow} className="underline hover:text-seal">
              Clear
            </button>
          </p>
        )}

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
          {messages.map((m) => {
            const saved = savedMessageIds.has(m.id);
            return (
              <div key={m.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="label mb-1 text-muted">{m.role === "guide" ? "AVAIA" : m.speaker_name ?? "Participant"}</p>
                  {saved ? (
                    <span className="text-xs text-seal">Saved to Shared Workbook</span>
                  ) : (
                    <button
                      onClick={() => saveMessageToWorkbook(m.id)}
                      disabled={savingMessageId === m.id}
                      className="text-xs text-muted underline hover:text-seal disabled:opacity-50"
                    >
                      {savingMessageId === m.id ? "Saving…" : "Save to Shared Workbook"}
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-ink">{m.content}</p>
              </div>
            );
          })}
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

        {/* Pending private-processing links, shown only to be handed over.
            This view has no way to see what happens once one is opened;
            "Check for updates" above is the only way anything from it can
            appear back in the Room, and only if the participant chooses
            to bring something forward themselves. */}
        {pendingPrivate.map((pp) => (
          <div key={pp.participantId} className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] p-4">
            <p className="label mb-1 text-muted">Private processing, {pp.participantName}</p>
            <p className="mb-3 text-sm text-muted">
              Hand this link to {pp.participantName} to open on their own device, or in a private/
              incognito window, not in this tab. This view cannot see what happens there.
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

      {/* Shared Room Workbook, "OURS" -- what the Table intentionally chose
          to keep, never the full conversation above (that's what "The
          Room" section already is) and never anyone's personal Workbook. */}
      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label text-seal">Shared Room Workbook</p>
        <h2 className="mt-1 font-serif text-xl text-ink">What This Table Is Carrying Forward</h2>
        <p className="mt-1 text-sm text-muted">
          Not the full conversation, only what was intentionally saved. Visible to everyone
          currently seated at this Table.
        </p>
        <p className="mt-2">
          <Link href="/library" className="text-xs text-muted underline hover:text-seal">
            Explore the AVAIA Library →
          </Link>
        </p>

        <div className="mt-5 space-y-4">
          {workbookItems.length === 0 && (
            <p className="text-sm text-muted">Nothing has been saved to this Room&rsquo;s Workbook yet.</p>
          )}
          {workbookItems.map((w) => (
            <div key={w.id} className="rounded-md border border-rule bg-white/[0.03] p-4">
              <p className="whitespace-pre-wrap text-ink">{w.content}</p>
              <p className="mt-2 text-xs text-muted">
                {w.speakerName ? `${w.speakerName} · ` : ""}
                {w.source === "private_share" ? "shared from a private conversation" : w.source === "note" ? "added as a note" : "saved from the Room"}
                {w.addedByName && w.source !== "private_share" ? ` · saved by ${w.addedByName}` : ""}
                {" · "}
                {new Date(w.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          ))}
        </div>

        {room.status === "active" && (
          <div className="mt-5 flex gap-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add a note the Table wants to remember…"
              className="flex-1 rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
            />
            <button
              onClick={addNote}
              disabled={addingNote || !noteInput.trim()}
              className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              {addingNote ? "Adding…" : "Add note"}
            </button>
          </div>
        )}
      </section>

      {/* Close / continuity */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        {room.status === "active" ? (
          <>
            <p className="label mb-3 text-muted">Close This Room</p>
            <p className="text-muted">
              Generates the Room&rsquo;s own closing record from the shared conversation above.
              Nothing any participant kept private is included. Closing isn&rsquo;t final, this
              Room can be reopened later with its full history intact.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={closeRoom}
                disabled={closing || messages.length === 0}
                className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
              >
                {closing ? "Closing…" : "Close Room"}
              </button>
              <button
                onClick={() => changeStatus("pause")}
                disabled={statusBusy}
                className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-muted hover:border-seal hover:text-ink disabled:opacity-50"
              >
                Pause Room
              </button>
            </div>
          </>
        ) : room.status === "paused" ? (
          <>
            <p className="label mb-3 text-muted">This Room Is Paused</p>
            <p className="text-muted">
              Still here to reread. No one can add new turns until it&rsquo;s reopened.
            </p>
            <button
              onClick={() => changeStatus("reopen")}
              disabled={statusBusy}
              className="mt-3 rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              Reopen Room
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
            <RoomLifecycleControls status={room.status} busy={statusBusy} onChange={changeStatus} />
          </>
        ) : (
          <>
            <p className="text-muted">
              {room.status === "archived" ? "This Room is archived, but its history is still here." : "This Room is closed."}
            </p>
            <RoomLifecycleControls status={room.status} busy={statusBusy} onChange={changeStatus} />
          </>
        )}
      </section>
    </div>
  );
}

/** The reversible half of a Room's lifecycle: a completed or archived
 *  Room's history is never gone, only its current status changes. Kept as
 *  a small helper since it's rendered from three different branches above
 *  (with referral, without one, and could apply to either status). */
function RoomLifecycleControls({
  status,
  busy,
  onChange,
}: {
  status: "active" | "paused" | "complete" | "archived";
  busy: boolean;
  onChange: (action: "pause" | "reopen" | "archive" | "unarchive") => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-2 border-t border-rule pt-6">
      {status === "complete" && (
        <>
          <button
            onClick={() => onChange("reopen")}
            disabled={busy}
            className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
          >
            Reopen Room
          </button>
          <button
            onClick={() => onChange("archive")}
            disabled={busy}
            className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-muted hover:border-seal hover:text-ink disabled:opacity-50"
          >
            Archive Room
          </button>
        </>
      )}
      {status === "archived" && (
        <button
          onClick={() => onChange("unarchive")}
          disabled={busy}
          className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
        >
          Unarchive Room
        </button>
      )}
    </div>
  );
}
