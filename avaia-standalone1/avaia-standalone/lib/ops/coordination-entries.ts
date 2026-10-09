import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hostVoiceItems, referralItemText, isOfferableField, type HostVoiceField } from "@/lib/kept-items";
import { listRoomParticipants, loadRoomMessages, resolveSeatedParticipant } from "@/lib/engine/room";
import { isUuid } from "@/lib/coordination";
import { facilitatedConversationIds, getCoordinationItem, isAdultHost } from "@/lib/ops/coordination";
import {
  ENTRY_LIMITS,
  PRIVATE_PRESENT_NOTE,
  isEntryType,
  roomPresentNote,
  wholeMessageExcerpt,
  type CoordinationEntry,
  type EntryType,
} from "@/lib/coordination-entries";

// THE DECISION & CAPACITY CONTINUITY RECORD (the I/O side), Workbook Phase 2. See
// lib/coordination-entries.ts for the rules and supabase/migrations/0121_coordination_entries.sql
// for the database's own protections. Decision 0008.
//
// Privacy and integrity posture of this file:
//  * A Host's own browser can directly create only a Host note (that is all the database's insert
//    policy allows). An entry that copies a source (a conversation message, a referral field, a Shared
//    Room message) is written HERE, by the server, after it has re-read the source itself. The stored
//    excerpt is built from the real source, never from text the browser sent. The database then
//    verifies the entry a second time and stamps the source's own timestamp.
//  * Only the Host's OWN words are copied: their own conversation messages (role 'host'), their own
//    Shared Room messages (the seat they are linked to), and the Host-voiced referral fields the
//    existing Keep this rules already recognize. Other participants' words are never copied.
//  * Nothing is copied automatically. Every function below runs only on the Host's own action.
//  * The service-role client is used ONLY for the two things a Host's own RLS identity cannot do: the
//    verified insert of a source-backed entry, and reading the Host's own seat in a Room (Room tables
//    are readable by RLS only through the facilitating Guide's account). It is always preceded by a
//    re-check of the Host's identity, that they are an adult, and that the decision is theirs.
//  * Nothing here interprets, compares, summarizes or labels an entry. The Host chooses every type.

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

const COLUMNS =
  "id, host_id, item_id, entry_type, source_kind, occurred_at, excerpt, host_note, conversation_id, message_id, referral_id, referral_field, referral_index, room_id, room_message_id, room_label, present_note, source_key, created_at, withdrawn_at";

type DbError = { code?: string; message?: string } | null | undefined;

/** The database's own plain-language refusals (raised by the integrity rules) are safe to show;
 *  anything else gets a generic message. */
function friendly(error: DbError): string {
  if (error?.code === "P0001" && error.message) return error.message;
  if (error?.code === "23505") return "That is already in this record as that kind of entry.";
  if (error?.code === "23514") return "One of those entries is not allowed.";
  if (error?.code === "42501") return "That is not available on this account.";
  return "That could not be saved. Please try again.";
}

/** The decision must be the Host's own, and the Host an adult. */
async function requireOwnDecision(supabase: SupabaseClient, hostId: string, itemId: string): Promise<Result> {
  if (!isUuid(itemId)) return { ok: false, error: "That decision could not be found." };
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "The continuity record is available to adult accounts in this release." };
  const item = await getCoordinationItem(supabase, hostId, itemId);
  if (!item || item.kind !== "decision") return { ok: false, error: "Choose one of your own decisions." };
  return { ok: true };
}

export async function listEntriesForItem(supabase: SupabaseClient, hostId: string, itemId: string): Promise<CoordinationEntry[]> {
  if (!isUuid(itemId)) return [];
  const { data, error } = await supabase
    .from("coordination_entries")
    .select(COLUMNS)
    .eq("host_id", hostId)
    .eq("item_id", itemId)
    .order("occurred_at", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CoordinationEntry[];
}

// ---- What the Host can choose from ---------------------------------------------------------------

export type OwnMessage = { id: string; content: string; created_at: string };

/** The Host's own words in one of their own conversations, oldest first. Never AI replies, never a
 *  conversation a Guide facilitated for someone else. */
export async function listOwnMessages(supabase: SupabaseClient, hostId: string, conversationId: string): Promise<OwnMessage[]> {
  if (!isUuid(conversationId)) return [];
  if ((await facilitatedConversationIds(supabase, hostId)).has(conversationId)) return [];
  const { data: convo } = await supabase.from("conversations").select("id").eq("id", conversationId).eq("host_id", hostId).maybeSingle();
  if (!convo) return [];
  const { data } = await supabase
    .from("messages")
    .select("id, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "host")
    .order("created_at", { ascending: true })
    .limit(200);
  return (data ?? []) as OwnMessage[];
}

export type ReferralChoice = { field: HostVoiceField; index: number; text: string };

/** The Host-voiced items of one of the Host's own referrals (the same fields Keep this offers). */
export async function listReferralChoices(supabase: SupabaseClient, hostId: string, referralId: string): Promise<ReferralChoice[]> {
  if (!isUuid(referralId)) return [];
  const { data } = await supabase.from("referrals").select("id, conversation_id, content").eq("id", referralId).eq("host_id", hostId).maybeSingle();
  const row = data as { id: string; conversation_id: string | null; content: unknown } | null;
  if (!row) return [];
  if (row.conversation_id && (await facilitatedConversationIds(supabase, hostId)).has(row.conversation_id)) return [];
  return hostVoiceItems(row.content);
}

export type SeatedRoom = { id: string; title: string; status: string };

/** The Rooms the Host is seated in right now, read through the existing seat records
 *  (guide_participants.linked_host_id → room_participants). Read-only. */
export async function listSeatedRooms(hostId: string): Promise<SeatedRoom[]> {
  const admin = createAdminClient();
  const { data: asParticipant } = await admin.from("guide_participants").select("id").eq("linked_host_id", hostId);
  const participantIds = ((asParticipant as { id: string }[]) ?? []).map((p) => p.id);
  if (participantIds.length === 0) return [];
  const { data: seats } = await admin
    .from("room_participants")
    .select("room_id")
    .in("guide_participant_id", participantIds)
    .is("removed_at", null);
  const roomIds = [...new Set(((seats as { room_id: string }[]) ?? []).map((s) => s.room_id))];
  if (roomIds.length === 0) return [];
  const { data: rooms } = await admin.from("rooms").select("id, title, status").in("id", roomIds).order("created_at", { ascending: false });
  return ((rooms as { id: string; title: string | null; status: string }[]) ?? []).map((r) => ({ id: r.id, title: r.title ?? "Shared Room", status: r.status }));
}

/** The Host's OWN words in a Room they are seated in. Other participants' words are not returned. */
export async function listOwnRoomMessages(hostId: string, roomId: string): Promise<OwnMessage[]> {
  if (!isUuid(roomId)) return [];
  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, hostId);
  if (!seated) return [];
  const messages = await loadRoomMessages(admin, roomId);
  return messages
    .filter((m) => m.role === "participant" && m.speaker_participant_id === seated.participantId)
    .map((m) => ({ id: m.id, content: m.content, created_at: m.created_at }));
}

// ---- Adding to the record ------------------------------------------------------------------------

type EntryRow = {
  host_id: string;
  item_id: string;
  entry_type: EntryType;
  source_kind: string;
  occurred_at: string;
  excerpt: string;
  host_note: string | null;
  present_note: string | null;
  conversation_id?: string;
  message_id?: string;
  referral_id?: string;
  referral_field?: string;
  referral_index?: number;
  room_id?: string;
  room_message_id?: string;
  room_label?: string;
};

/** The one verified insert. Always preceded by the caller's own identity and ownership checks. The
 *  database re-verifies the source and stamps the source's own timestamp. */
async function insertVerified(row: EntryRow): Promise<Result<{ id: string }>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("coordination_entries").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: friendly(error) };
  return { ok: true, id: (data as { id: string }).id };
}

/** The Host's own written note. The browser may create this directly under RLS, but it goes through
 *  the same ownership checks here. */
export async function addHostNoteEntry(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  entryType: string,
  noteText: string
): Promise<Result<{ id: string }>> {
  if (!isEntryType(entryType)) return { ok: false, error: "Choose what this entry is." };
  const own = await requireOwnDecision(supabase, hostId, itemId);
  if (!own.ok) return own;
  const { data, error } = await supabase
    .from("coordination_entries")
    .insert({
      host_id: hostId,
      item_id: itemId,
      entry_type: entryType,
      source_kind: "host_note",
      occurred_at: new Date().toISOString(),
      excerpt: noteText,
      present_note: null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: friendly(error) };
  return { ok: true, id: (data as { id: string }).id };
}

/** One of the Host's own conversation messages, kept whole. The browser sends only the message id;
 *  the excerpt is built here from the message as it really is. */
export async function addConversationMessageEntry(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  entryType: string,
  messageId: string,
  hostNote: string | null
): Promise<Result<{ id: string }>> {
  if (!isEntryType(entryType)) return { ok: false, error: "Choose what this entry is." };
  if (!isUuid(messageId)) return { ok: false, error: "That message could not be found." };
  const own = await requireOwnDecision(supabase, hostId, itemId);
  if (!own.ok) return own;

  const { data } = await supabase.from("messages").select("id, conversation_id, role, content, created_at").eq("id", messageId).maybeSingle();
  const message = data as { id: string; conversation_id: string; role: string; content: string; created_at: string } | null;
  if (!message || message.role !== "host") return { ok: false, error: "That message could not be found." };
  if ((await facilitatedConversationIds(supabase, hostId)).has(message.conversation_id)) return { ok: false, error: "That message could not be found." };
  const { data: convo } = await supabase.from("conversations").select("id").eq("id", message.conversation_id).eq("host_id", hostId).maybeSingle();
  if (!convo) return { ok: false, error: "That message could not be found." };

  const excerpt = wholeMessageExcerpt(message.content);
  if (!excerpt.ok) return excerpt;
  return insertVerified({
    host_id: hostId,
    item_id: itemId,
    entry_type: entryType,
    source_kind: "conversation_message",
    occurred_at: message.created_at,
    excerpt: excerpt.excerpt,
    host_note: hostNote,
    present_note: PRIVATE_PRESENT_NOTE,
    conversation_id: message.conversation_id,
    message_id: message.id,
  });
}

/** One Host-voiced referral field. Labelled "From your referral" everywhere it is shown. Uses the
 *  existing referralItemText rule, with the text resolved from the stored referral. */
export async function addReferralFieldEntry(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  entryType: string,
  referralId: string,
  field: string,
  index: number,
  hostNote: string | null
): Promise<Result<{ id: string }>> {
  if (!isEntryType(entryType)) return { ok: false, error: "Choose what this entry is." };
  if (!isUuid(referralId) || !isOfferableField(field) || !Number.isInteger(index) || index < 0) return { ok: false, error: "That item could not be found." };
  const own = await requireOwnDecision(supabase, hostId, itemId);
  if (!own.ok) return own;

  const { data } = await supabase.from("referrals").select("id, conversation_id, content, created_at").eq("id", referralId).eq("host_id", hostId).maybeSingle();
  const row = data as { id: string; conversation_id: string | null; content: unknown; created_at: string } | null;
  if (!row) return { ok: false, error: "That item could not be found." };
  if (row.conversation_id && (await facilitatedConversationIds(supabase, hostId)).has(row.conversation_id)) return { ok: false, error: "That item could not be found." };
  const value = referralItemText(row.content, field, index);
  if (!value) return { ok: false, error: "That item could not be found." };
  if (value.length > ENTRY_LIMITS.excerpt) return { ok: false, error: "That is too long to record." };

  return insertVerified({
    host_id: hostId,
    item_id: itemId,
    entry_type: entryType,
    source_kind: "referral_field",
    occurred_at: row.created_at,
    excerpt: value,
    host_note: hostNote,
    present_note: PRIVATE_PRESENT_NOTE,
    referral_id: row.id,
    referral_field: field,
    referral_index: index,
  });
}

/** One of the Host's OWN messages in a Shared Room they are seated in. Read through the existing
 *  seated-participant path; other participants' words are never copied. Room ownership and access
 *  are not touched. The present note is a snapshot of the Room's own seat records at that moment. */
export async function addRoomMessageEntry(
  supabase: SupabaseClient,
  hostId: string,
  itemId: string,
  entryType: string,
  roomId: string,
  roomMessageId: string,
  hostNote: string | null
): Promise<Result<{ id: string }>> {
  if (!isEntryType(entryType)) return { ok: false, error: "Choose what this entry is." };
  if (!isUuid(roomId) || !isUuid(roomMessageId)) return { ok: false, error: "That message could not be found." };
  const own = await requireOwnDecision(supabase, hostId, itemId);
  if (!own.ok) return own;

  const admin = createAdminClient();
  const seated = await resolveSeatedParticipant(admin, roomId, hostId);
  if (!seated) return { ok: false, error: "You aren't currently seated in that Room." };
  const messages = await loadRoomMessages(admin, roomId);
  const message = messages.find((m) => m.id === roomMessageId);
  if (!message || message.role !== "participant" || message.speaker_participant_id !== seated.participantId) {
    return { ok: false, error: "Only your own words in a Room can be added." };
  }
  const excerpt = wholeMessageExcerpt(message.content);
  if (!excerpt.ok) return excerpt;

  const { data: room } = await admin.from("rooms").select("title").eq("id", roomId).maybeSingle();
  const seats = await listRoomParticipants(admin, roomId, { activeOnly: false });
  return insertVerified({
    host_id: hostId,
    item_id: itemId,
    entry_type: entryType,
    source_kind: "room_message",
    occurred_at: message.created_at,
    excerpt: excerpt.excerpt,
    host_note: hostNote,
    present_note: roomPresentNote(seats, message.created_at),
    room_id: roomId,
    room_message_id: message.id,
    room_label: ((room as { title: string | null } | null)?.title ?? "Shared Room").slice(0, 200),
  });
}

/** Withdraw an entry from active use, or restore it. The entry itself is never changed; the database
 *  stamps withdrawn_at and refuses any other change. There is no delete. */
export async function setEntryWithdrawn(supabase: SupabaseClient, hostId: string, entryId: string, withdrawn: boolean): Promise<Result> {
  if (!isUuid(entryId)) return { ok: false, error: "That entry could not be found." };
  if (!(await isAdultHost(supabase, hostId))) return { ok: false, error: "The continuity record is available to adult accounts in this release." };
  const { data, error } = await supabase
    .from("coordination_entries")
    .update({ withdrawn_at: withdrawn ? new Date().toISOString() : null })
    .eq("id", entryId)
    .eq("host_id", hostId)
    .select("id");
  if (error) return { ok: false, error: friendly(error) };
  if (!data || data.length === 0) return { ok: false, error: "That entry could not be found." };
  return { ok: true };
}
