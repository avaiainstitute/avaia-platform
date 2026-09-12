"use client";

import { useEffect, useState } from "react";
import { createParticipantClient } from "@/lib/supabase/participant-client";

type Phase = "loading" | "error" | "in-room";

type RoomParticipant = {
  room_participant_id: string;
  participant_id: string;
  name: string;
  developmental_band: string | null;
  added_at: string;
  removed_at: string | null;
  last_seen_at: string | null;
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
  floor_participant_id: string | null;
};

type TurnRequest = {
  id: string;
  participant_id: string;
  name: string;
  status: "pending" | "recognized" | "withdrawn";
  requested_at: string;
};

type BringForward = { mode: "none" } | { mode: "own" } | { mode: "all" } | { mode: "pick" } | { mode: "workbook" };

// The Room's own curated Shared Workbook, "OURS", not this participant's
// own personal Workbook (untouched, lives entirely at /workbook).
type WorkbookItem = {
  id: string;
  content: string;
  speakerName: string | null;
  source: "room_message" | "note" | "private_share";
  addedByName: string;
  createdAt: string;
  sourceRoomMessageId: string | null;
};

/** A participant's own entry into a Shared Room, opened from a durable
 *  invitation link the Guide hands over (lib/engine/room.ts's
 *  getOrCreateRoomInvitation), never from the Guide's own signed-in tab.
 *  Runs on the same isolated, sessionStorage-based client as the private-
 *  processing page (lib/supabase/participant-client.ts), for the same
 *  reason: opening this in a second tab of a browser the Guide is signed
 *  into must never touch the Guide's own cookie session.
 *
 *  Everything here talks to /api/room-participant/* with this session's
 *  own bearer token, mirroring app/room-access/[token]/page.tsx's pattern
 *  exactly, one level up: that page is a single private conversation,
 *  this page is the shared Room itself, seen and spoken in as this one
 *  participant. */
export default function RoomJoinPage({ params }: { params: { token: string } }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [roomId, setRoomId] = useState("");
  const [me, setMe] = useState<{ participantId: string; name: string } | null>(null);
  const [myLastSeenAt, setMyLastSeenAt] = useState<string | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [pendingTurnRequests, setPendingTurnRequests] = useState<TurnRequest[]>([]);
  const [myTurnRequest, setMyTurnRequest] = useState<TurnRequest | null>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [raising, setRaising] = useState(false);

  const [workbookItems, setWorkbookItems] = useState<WorkbookItem[]>([]);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [pickedWorkbookIds, setPickedWorkbookIds] = useState<Set<string>>(new Set());

  const [steppingOut, setSteppingOut] = useState(false);
  const [bringForward, setBringForward] = useState<BringForward>({ mode: "none" });
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [startingPrivate, setStartingPrivate] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/room-access/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: params.token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "This invitation isn't valid.");
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
        setRoomId(data.roomId);
        await loadRoom(data.roomId, verified.session.access_token);
        await loadWorkbook(data.roomId, verified.session.access_token);
        setPhase("in-room");
      } catch {
        setError("Something went wrong opening this Room.");
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRoom(id: string, token: string) {
    const res = await fetch(`/api/room-participant/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not open this Room.");
    setRoom(data.room);
    setParticipants(data.participants);
    setMessages(data.messages);
    setMe(data.me);
    setMyLastSeenAt(data.myLastSeenAt);
    setPendingTurnRequests(data.pendingTurnRequests);
    setMyTurnRequest(data.myTurnRequest);
  }

  async function loadWorkbook(id: string, token: string) {
    const res = await fetch(`/api/room-participant/${id}/workbook`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setWorkbookItems(data.items ?? []);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await loadRoom(roomId, accessToken);
      await loadWorkbook(roomId, accessToken);
    } catch {
      /* keep showing what we already have */
    } finally {
      setRefreshing(false);
    }
  }

  /** Explicitly keeps one shared-thread message in the Room's own Shared
   *  Workbook. Never automatic. */
  async function saveMessageToWorkbook(messageId: string) {
    setSavingMessageId(messageId);
    setError("");
    try {
      const res = await fetch(`/api/room-participant/${roomId}/workbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "save_message", messageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save that to the Shared Workbook.");
      await loadWorkbook(roomId, accessToken);
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
      const res = await fetch(`/api/room-participant/${roomId}/workbook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "add_note", content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add that note.");
      setNoteInput("");
      await loadWorkbook(roomId, accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAddingNote(false);
    }
  }

  function toggleWorkbookPick(id: string) {
    setPickedWorkbookIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || sending || room?.status !== "active") return;
    setInput("");
    setSending(true);
    try {
      const res = await fetch(`/api/room-participant/${roomId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send that.");
      await loadRoom(roomId, accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  async function toggleHand() {
    setRaising(true);
    try {
      if (myTurnRequest) {
        await fetch(`/api/room-participant/${roomId}/turn`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } else {
        await fetch(`/api/room-participant/${roomId}/turn`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      await loadRoom(roomId, accessToken);
    } finally {
      setRaising(false);
    }
  }

  function togglePick(id: string) {
    setPickedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startPrivate() {
    if (!me) return;
    setStartingPrivate(true);
    setError("");
    try {
      const contextSelection =
        bringForward.mode === "none"
          ? { mode: "none" as const }
          : bringForward.mode === "own"
          ? { mode: "own" as const, participantId: me.participantId }
          : bringForward.mode === "all"
          ? { mode: "all" as const }
          : bringForward.mode === "workbook"
          ? { mode: "workbookItemIds" as const, itemIds: Array.from(pickedWorkbookIds) }
          : { mode: "messageIds" as const, messageIds: Array.from(pickedIds) };

      const res = await fetch(`/api/room-participant/${roomId}/step-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ contextSelection }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start a private conversation.");
      window.location.href = data.accessUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStartingPrivate(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-prose px-5 py-24 text-center">
        <p className="label mb-3">One moment</p>
        <h1 className="font-serif text-2xl text-ink">Opening the Room…</h1>
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

  if (!room || !me) return null;

  const ownMessages = messages.filter((m) => m.role === "participant" && m.speaker_participant_id === me.participantId);
  const floorName = room.floor_participant_id
    ? participants.find((p) => p.participant_id === room.floor_participant_id)?.name ?? null
    : null;
  const firstUnreadIndex = myLastSeenAt ? messages.findIndex((m) => m.created_at > myLastSeenAt) : messages.length > 0 ? 0 : -1;
  const savedMessageIds = new Set(
    workbookItems.map((w) => w.sourceRoomMessageId).filter((id): id is string => !!id)
  );

  return (
    <div className="mx-auto max-w-prose px-5 py-12">
      <p className="label mb-2 text-muted">{me.name}, at the Table</p>
      <h1 className="font-serif text-2xl text-ink">{room.title || "This Room"}</h1>
      {room.status !== "active" && (
        <p className="mt-2 text-sm text-muted">
          {room.status === "paused" ? "This Room is paused right now." : "This Room has closed, but you can still read it."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {participants.map((p) => (
          <span
            key={p.participant_id}
            className="rounded-full border border-rule bg-white/[0.04] px-3 py-1 text-xs text-muted"
          >
            {p.name}
            {p.participant_id === me.participantId && " (you)"}
          </span>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-[#e0857d]">{error}</p>}

      <div className="mt-6 flex items-baseline justify-between">
        <p className="label text-muted">The Room</p>
        <button onClick={refresh} disabled={refreshing} className="text-xs text-muted underline hover:text-seal disabled:opacity-50">
          {refreshing ? "Checking…" : "Check for updates"}
        </button>
      </div>

      <div className="mt-3 max-h-[28rem] space-y-4 overflow-y-auto rounded-lg border border-rule bg-white/[0.03] p-4">
        {messages.length === 0 && <p className="text-muted">Nothing has been said in this Room yet.</p>}
        {messages.map((m, i) => {
          const saved = savedMessageIds.has(m.id);
          return (
            <div key={m.id}>
              {i === firstUnreadIndex && i > 0 && (
                <p className="label mb-3 mt-1 text-center text-muted">— while you were away —</p>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <p className="label mb-1 text-muted">{m.role === "guide" ? "AVAIA" : m.speaker_name ?? "Participant"}</p>
                {saved ? (
                  <span className="text-xs text-seal">Saved</span>
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

      {pendingTurnRequests.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Waiting to speak: {pendingTurnRequests.map((r) => r.name).join(", ")}
        </p>
      )}
      {floorName && <p className="mt-1 text-xs text-muted">The floor is with {floorName}.</p>}

      {room.status === "active" && (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              disabled={sending}
              placeholder="Speak to the Table…"
              className="flex-1 rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] disabled:opacity-50"
            >
              Send
            </button>
          </div>
          <button
            onClick={toggleHand}
            disabled={raising}
            className="mt-2 text-xs text-muted underline hover:text-seal disabled:opacity-50"
          >
            {myTurnRequest ? "Lower your hand" : "Raise your hand to speak"}
          </button>
        </div>
      )}

      {/* Shared Room Workbook, "OURS" -- what the Table intentionally chose
          to keep, distinct from the full conversation above and from this
          participant's own personal Workbook (untouched). */}
      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-4">
        <p className="label text-seal">Shared Room Workbook</p>
        <p className="mt-1 text-sm text-muted">
          What this Table intentionally decided to carry forward. Not everything said, only
          what was saved.
        </p>
        <div className="mt-4 space-y-3">
          {workbookItems.length === 0 && (
            <p className="text-sm text-muted">Nothing saved here yet.</p>
          )}
          {workbookItems.map((w) => (
            <div key={w.id} className="rounded-md border border-rule bg-white/[0.03] p-3">
              <p className="whitespace-pre-wrap text-sm text-ink">{w.content}</p>
              <p className="mt-1 text-xs text-muted">
                {w.speakerName ? `${w.speakerName} · ` : ""}
                {w.source === "private_share" ? "shared from a private conversation" : w.source === "note" ? "added as a note" : "saved from the Room"}
              </p>
            </div>
          ))}
        </div>
        {room.status === "active" && (
          <div className="mt-4 flex gap-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add something the Table wants to remember…"
              className="flex-1 rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal"
            />
            <button
              onClick={addNote}
              disabled={addingNote || !noteInput.trim()}
              className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal disabled:opacity-50"
            >
              {addingNote ? "Adding…" : "Add"}
            </button>
          </div>
        )}
      </section>

      <div className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-4">
        {!steppingOut ? (
          <button
            onClick={() => setSteppingOut(true)}
            className="text-sm text-muted underline hover:text-seal"
          >
            Step into a private conversation
          </button>
        ) : (
          <div>
            <p className="label mb-2">A private conversation, just for you</p>
            <p className="mb-3 text-sm text-muted">
              Nothing from the Room comes with you unless you choose it. This choice is yours alone.
            </p>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={bringForward.mode === "none"}
                  onChange={() => setBringForward({ mode: "none" })}
                />
                Bring nothing, start with a clean page
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={bringForward.mode === "own"}
                  onChange={() => setBringForward({ mode: "own" })}
                  disabled={ownMessages.length === 0}
                />
                Bring only what I said in the Room
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={bringForward.mode === "all"}
                  onChange={() => setBringForward({ mode: "all" })}
                  disabled={messages.every((m) => m.role !== "participant")}
                />
                Bring the whole Room so far
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={bringForward.mode === "pick"}
                  onChange={() => setBringForward({ mode: "pick" })}
                  disabled={messages.every((m) => m.role !== "participant")}
                />
                Let me choose exactly what
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={bringForward.mode === "workbook"}
                  onChange={() => setBringForward({ mode: "workbook" })}
                  disabled={workbookItems.length === 0}
                />
                Bring specific items from the Shared Workbook
              </label>
            </div>

            {bringForward.mode === "pick" && (
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-md border border-rule bg-white/[0.03] p-3">
                {messages
                  .filter((m) => m.role === "participant")
                  .map((m) => (
                    <label key={m.id} className="flex items-start gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={pickedIds.has(m.id)}
                        onChange={() => togglePick(m.id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="text-ink">{m.speaker_name ?? "Participant"}: </span>
                        {m.content}
                      </span>
                    </label>
                  ))}
              </div>
            )}

            {bringForward.mode === "workbook" && (
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-md border border-rule bg-white/[0.03] p-3">
                {workbookItems.map((w) => (
                  <label key={w.id} className="flex items-start gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={pickedWorkbookIds.has(w.id)}
                      onChange={() => toggleWorkbookPick(w.id)}
                      className="mt-0.5"
                    />
                    <span>
                      {w.speakerName && <span className="text-ink">{w.speakerName}: </span>}
                      {w.content}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setSteppingOut(false)}
                className="rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink hover:border-seal"
              >
                Never mind
              </button>
              <button
                onClick={startPrivate}
                disabled={
                  startingPrivate ||
                  (bringForward.mode === "pick" && pickedIds.size === 0) ||
                  (bringForward.mode === "workbook" && pickedWorkbookIds.size === 0)
                }
                className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] disabled:opacity-50"
              >
                {startingPrivate ? "Opening…" : "Continue privately"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
