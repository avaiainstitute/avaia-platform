// THE DECISION & CAPACITY CONTINUITY RECORD (Workbook, Phase 2): the rules.
//
// Decision 0008: AVAIA may create and preserve a longitudinal record of a Host's expressed
// understanding, reasoning, choices, questions, and participation in consequential decisions.
// AVAIA does not independently determine or declare legal capacity or incapacity.
//
// What this file is, and is not:
//   * The record documents participation over time. Nothing here compares entries, decides that a
//     position changed, scores, summarizes or interprets. Every entry type, including the position
//     values, is chosen by the Host; the only text is the Host's own words, copied exactly from
//     where they were said, and their own notes.
//   * Withdraw, never erase: a Host can withdraw an entry from active use and restore it. The
//     entry is never rewritten or erased (there is no delete and no erased state).
//   * Pure rules only (no I/O), so the System Check self-test runs the very same functions
//     production uses.

import type { CoordinationItem } from "@/lib/coordination";

/** Chosen by the Host, never inferred. The wording of the first line is the Host's list. */
export const ENTRY_TYPES = [
  "wanted",
  "understood",
  "reasoning",
  "question",
  "alternative",
  "consequence",
  "undecided",
  "more_time",
  "position_consistent",
  "position_changed",
  "communicate_to_others",
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  wanted: "What I wanted",
  understood: "What I understood",
  reasoning: "My reasoning",
  question: "A question I asked",
  alternative: "An alternative I considered",
  consequence: "A consequence I discussed",
  undecided: "I remained undecided",
  more_time: "I asked for more time",
  position_consistent: "My position stayed the same",
  position_changed: "My position changed",
  communicate_to_others: "What I want communicated to others",
};

/** The Host-selected position values. AVAIA never decides that a position changed. */
export const POSITION_TYPES = ["wanted", "position_consistent", "position_changed"] as const;
export type PositionType = (typeof POSITION_TYPES)[number];
export function isPositionType(t: EntryType): t is PositionType {
  return (POSITION_TYPES as readonly string[]).includes(t);
}

export const SOURCE_KINDS = ["conversation_message", "referral_field", "room_message", "host_note"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** How each source is shown. A referral field is a structured summary in the Host's voice and is
 *  never presented as a verbatim conversation message. */
export const SOURCE_LABEL: Record<SourceKind, string> = {
  conversation_message: "Your own words, from a conversation with AVAIA",
  referral_field: "From your referral",
  room_message: "Your own words, from a Shared Room",
  host_note: "Written by you",
};

/** Private versus Shared Room, for display and the record. */
export function isSharedRoomSource(kind: SourceKind): boolean {
  return kind === "room_message";
}

export const ENTRY_LIMITS = { excerpt: 20000, hostNote: 2000, present: 1000 } as const;

export type CoordinationEntry = {
  id: string;
  host_id: string;
  item_id: string;
  entry_type: EntryType;
  source_kind: SourceKind;
  occurred_at: string;
  excerpt: string;
  host_note: string | null;
  conversation_id: string | null;
  message_id: string | null;
  referral_id: string | null;
  referral_field: string | null;
  referral_index: number | null;
  room_id: string | null;
  room_message_id: string | null;
  room_label: string | null;
  present_note: string | null;
  source_key: string | null;
  created_at: string;
  withdrawn_at: string | null;
};

export function isEntryType(v: unknown): v is EntryType {
  return typeof v === "string" && (ENTRY_TYPES as readonly string[]).includes(v);
}

type Raw = Record<string, FormDataEntryValue | null | undefined>;
const text = (raw: Raw, key: string): string => {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
};

export type EntryInput = { entryType: EntryType; hostNote: string | null };

/** What the Host chose for an entry: its type and, optionally, their own note (for a changed
 *  position, their own explanation). Nothing is defaulted or generated. */
export function parseEntryInput(raw: Raw): { ok: true; value: EntryInput } | { ok: false; error: string } {
  const type = text(raw, "entry_type");
  if (!isEntryType(type)) return { ok: false, error: "Choose what this entry is." };
  const note = text(raw, "host_note");
  if (note.length > ENTRY_LIMITS.hostNote) return { ok: false, error: `Your note can be up to ${ENTRY_LIMITS.hostNote} characters.` };
  return { ok: true, value: { entryType: type, hostNote: note.length > 0 ? note : null } };
}

/** The Host's own written note as an entry: the text they typed. */
export function parseNoteText(raw: Raw): { ok: true; text: string } | { ok: false; error: string } {
  const value = text(raw, "note_text");
  if (value.length === 0) return { ok: false, error: "Write what you want to record." };
  if (value.length > ENTRY_LIMITS.excerpt) return { ok: false, error: `That is too long to record. The limit is ${ENTRY_LIMITS.excerpt} characters.` };
  return { ok: true, text: value };
}

/** The first version keeps a whole message. The excerpt is the message's own text, exactly as
 *  it was written (not trimmed or edited), so it can always be found in the source. */
export function wholeMessageExcerpt(content: unknown): { ok: true; excerpt: string } | { ok: false; error: string } {
  if (typeof content !== "string" || content.trim().length === 0) return { ok: false, error: "That message has no text to record." };
  if (content.length > ENTRY_LIMITS.excerpt) return { ok: false, error: "That message is too long to keep whole." };
  return { ok: true, excerpt: content };
}

/** Who was present, for a private conversation or a referral from one. */
export const PRIVATE_PRESENT_NOTE = "You and AVAIA";

/** Who was present in a Shared Room at the moment a message was said, from the Room's own seat
 *  records (added and removed times). Someone who merely had access is not counted. */
export function roomPresentNote(
  seats: { name: string; added_at: string; removed_at: string | null }[],
  at: string
): string {
  const when = Date.parse(at);
  const names = seats
    .filter((s) => Date.parse(s.added_at) <= when && (s.removed_at === null || Date.parse(s.removed_at) > when))
    .map((s) => s.name);
  const note = names.length > 0 ? `Shared Room: ${names.join(", ")}` : "Shared Room: no seated participants on record at that time";
  return note.slice(0, ENTRY_LIMITS.present);
}

/** Entries in active use. A withdrawn entry stays in the record but is not active. */
export function activeEntries<T extends Pick<CoordinationEntry, "withdrawn_at">>(entries: T[]): T[] {
  return entries.filter((e) => e.withdrawn_at === null);
}

const byTime = (a: Pick<CoordinationEntry, "occurred_at" | "created_at">, b: Pick<CoordinationEntry, "occurred_at" | "created_at">) =>
  Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || Date.parse(a.created_at) - Date.parse(b.created_at);

/** "Your stated position over time": only the Host-selected position entries that are in active
 *  use, in the order they occurred. Each is shown as written. Nothing is compared, summarized or
 *  labelled by AVAIA. */
export function positionOverTime<T extends Pick<CoordinationEntry, "entry_type" | "withdrawn_at" | "occurred_at" | "created_at">>(entries: T[]): T[] {
  return activeEntries(entries)
    .filter((e) => isPositionType(e.entry_type))
    .sort(byTime);
}

export type TimelineEvent =
  | { kind: "item_added"; at: string }
  | { kind: "entry"; at: string; entry: CoordinationEntry }
  | { kind: "item_closed"; at: string };

/** The timeline, generated from records that already exist: the item's creation, each entry (a
 *  withdrawn entry stays, flagged as withdrawn, and is never shown as active), and the item's
 *  CURRENT closed state. No timeline of its own is stored, and no event is invented. (Phase 1
 *  keeps no history of earlier closes and reopens, so only the current closure appears.) */
export function buildTimeline(
  item: Pick<CoordinationItem, "created_at" | "status" | "closed_at">,
  entries: CoordinationEntry[]
): TimelineEvent[] {
  const order = { item_added: 0, entry: 1, item_closed: 2 } as const;
  const events: TimelineEvent[] = [{ kind: "item_added", at: item.created_at }];
  for (const entry of entries) events.push({ kind: "entry", at: entry.occurred_at, entry });
  if (item.status === "closed" && item.closed_at) events.push({ kind: "item_closed", at: item.closed_at });
  return events.sort((a, b) => {
    const t = Date.parse(a.at) - Date.parse(b.at);
    if (t !== 0) return t;
    if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
    if (a.kind === "entry" && b.kind === "entry") return Date.parse(a.entry.created_at) - Date.parse(b.entry.created_at);
    return 0;
  });
}

/** Whether "when it was said" and "when it was added to the record" are effectively the same
 *  moment (a Host note), so the page shows one date instead of two. */
export function sameMoment(a: string, b: string, toleranceMs = 60_000): boolean {
  return Math.abs(Date.parse(a) - Date.parse(b)) <= toleranceMs;
}

/** The statement shown, verbatim, on the record page (Decision 0008). Nothing else about capacity
 *  is added anywhere. */
export const GOVERNING_STATEMENT =
  "AVAIA may create and preserve a longitudinal record of a Host’s expressed understanding, reasoning, choices, questions, and participation in consequential decisions. AVAIA does not independently determine or declare legal capacity or incapacity.";
