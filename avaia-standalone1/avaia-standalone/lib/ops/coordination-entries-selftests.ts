import "server-only";
import {
  ENTRY_LIMITS,
  ENTRY_TYPES,
  ENTRY_TYPE_LABEL,
  GOVERNING_STATEMENT,
  POSITION_TYPES,
  PRIVATE_PRESENT_NOTE,
  SOURCE_KINDS,
  SOURCE_LABEL,
  activeEntries,
  buildTimeline,
  isSharedRoomSource,
  parseEntryInput,
  parseNoteText,
  positionOverTime,
  roomPresentNote,
  sameMoment,
  wholeMessageExcerpt,
  type CoordinationEntry,
} from "@/lib/coordination-entries";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR THE DECISION & CAPACITY CONTINUITY RECORD (Workbook, Phase 2). Simulated records
// only: nothing is read from or written to the database. They run the very same rules production
// runs, so if a future change quietly breaks one of these promises the next System Check reports it:
//
//   * every entry type, including the position values, is Host-selected and exactly the approved
//     vocabulary; there is no capacity, score or verdict type;
//   * an entry keeps the Host's own words exactly (a whole message is never trimmed or edited);
//   * a referral field is always labelled "From your referral" and never as a conversation message;
//   * "who was present" is "You and AVAIA" for a private conversation, and for a Shared Room only the
//     people the Room's own seat records show as seated at that moment;
//   * the timeline is built only from records that exist (the item, its entries, its current closed
//     state); a withdrawn entry stays in it, flagged, and never counts as active;
//   * nothing compares entries or decides a position changed;
//   * the governing statement is shown verbatim.
//
// The database half of the promise (Host-only policies, no delete policy, a Host can insert only a
// note, an entry is never rewritten, a copied source is re-verified) is proven against the live
// catalog by schema_rules in lib/ops/system-truth.ts.

type Case = { name: string; ok: boolean };

const entry = (over: Partial<CoordinationEntry>): CoordinationEntry => ({
  id: "e1",
  host_id: "h1",
  item_id: "d1",
  entry_type: "wanted",
  source_kind: "conversation_message",
  occurred_at: "2026-01-08T10:00:00Z",
  excerpt: "I want to keep the house.",
  host_note: null,
  conversation_id: "c1",
  message_id: "m1",
  referral_id: null,
  referral_field: null,
  referral_index: null,
  room_id: null,
  room_message_id: null,
  room_label: null,
  present_note: PRIVATE_PRESENT_NOTE,
  source_key: "message:m1",
  created_at: "2026-02-01T09:00:00Z",
  withdrawn_at: null,
  ...over,
});

function recordCheck(): CheckResult {
  const key = "pipeline_continuity_record";
  const label = "The Decision & Capacity Continuity Record behaves as designed";
  try {
    const cases: Case[] = [];

    // Vocabulary: exactly the approved eleven; positions are the three Host-selected values.
    cases.push({
      name: "the entry types are not exactly the approved eleven",
      ok:
        ENTRY_TYPES.length === 11 &&
        ["wanted", "understood", "reasoning", "question", "alternative", "consequence", "undecided", "more_time", "position_consistent", "position_changed", "communicate_to_others"].every((t) =>
          (ENTRY_TYPES as readonly string[]).includes(t)
        ),
    });
    cases.push({ name: "an entry type has no label", ok: ENTRY_TYPES.every((t) => ENTRY_TYPE_LABEL[t].length > 0) });
    cases.push({ name: "the position values are not wanted, position_consistent, position_changed", ok: POSITION_TYPES.join(",") === "wanted,position_consistent,position_changed" });
    cases.push({
      name: "a capacity, score, verdict or interpretation type exists",
      ok: !ENTRY_TYPES.some((t) => /capacity|score|verdict|competent|interpret|summary|conclusion/i.test(t)),
    });
    cases.push({ name: "the source kinds are not exactly the four approved", ok: SOURCE_KINDS.join(",") === "conversation_message,referral_field,room_message,host_note" });

    // Host choices are taken as given; nothing is generated.
    cases.push({ name: "an unknown entry type was accepted", ok: !parseEntryInput({ entry_type: "has_capacity" }).ok && !parseEntryInput({}).ok });
    const parsed = parseEntryInput({ entry_type: "position_changed", host_note: "  I learned the roof needs work.  " });
    cases.push({ name: "a changed position with the Host's own explanation did not parse", ok: parsed.ok && parsed.value.entryType === "position_changed" && parsed.value.hostNote === "I learned the roof needs work." });
    const noNote = parseEntryInput({ entry_type: "wanted" });
    cases.push({ name: "a missing Host note was filled in", ok: noNote.ok && noNote.value.hostNote === null });
    cases.push({ name: "an over-long Host note was accepted", ok: !parseEntryInput({ entry_type: "wanted", host_note: "x".repeat(ENTRY_LIMITS.hostNote + 1) }).ok });
    cases.push({ name: "a blank written note was accepted", ok: !parseNoteText({ note_text: "   " }).ok && parseNoteText({ note_text: " Keep it. " }).ok });

    // The Host's own words are kept exactly.
    const spoken = "  I want to keep the house,\n  at least until spring.  ";
    const whole = wholeMessageExcerpt(spoken);
    cases.push({ name: "a whole message was trimmed or edited", ok: whole.ok && whole.excerpt === spoken });
    cases.push({ name: "a blank message was accepted", ok: !wholeMessageExcerpt("   ").ok && !wholeMessageExcerpt(undefined).ok });
    cases.push({ name: "an over-long message was accepted", ok: !wholeMessageExcerpt("x".repeat(ENTRY_LIMITS.excerpt + 1)).ok });

    // Labels: a referral is never presented as a verbatim message.
    cases.push({ name: "a referral field is not labelled From your referral", ok: SOURCE_LABEL.referral_field === "From your referral" });
    cases.push({ name: "a referral field shares a label with a conversation message", ok: SOURCE_LABEL.referral_field !== SOURCE_LABEL.conversation_message && SOURCE_LABEL.referral_field !== SOURCE_LABEL.room_message });
    cases.push({ name: "private and Shared Room sources are not told apart", ok: isSharedRoomSource("room_message") && !isSharedRoomSource("conversation_message") && !isSharedRoomSource("referral_field") && !isSharedRoomSource("host_note") });

    // Who was present.
    cases.push({ name: "a private conversation is not 'You and AVAIA'", ok: PRIVATE_PRESENT_NOTE === "You and AVAIA" });
    const seats = [
      { name: "Dana", added_at: "2026-01-01T00:00:00Z", removed_at: null },
      { name: "Sam", added_at: "2026-01-01T00:00:00Z", removed_at: "2026-01-05T00:00:00Z" },
      { name: "Lee", added_at: "2026-03-01T00:00:00Z", removed_at: null },
    ];
    const present = roomPresentNote(seats, "2026-01-08T10:00:00Z");
    cases.push({ name: "the Room snapshot did not list exactly who was seated at that moment", ok: present === "Shared Room: Dana" });
    cases.push({ name: "someone removed before, or added after, was counted as present", ok: !present.includes("Sam") && !present.includes("Lee") });
    cases.push({ name: "an empty Room snapshot claimed someone was present", ok: roomPresentNote([], "2026-01-08T10:00:00Z").includes("no seated participants") });

    // Active versus withdrawn, and the position view.
    const a = entry({ id: "a", entry_type: "wanted", occurred_at: "2026-01-08T10:00:00Z" });
    const b = entry({ id: "b", entry_type: "position_consistent", occurred_at: "2026-01-29T10:00:00Z" });
    const c = entry({ id: "c", entry_type: "position_changed", occurred_at: "2026-03-18T10:00:00Z", host_note: "The roof." });
    const w = entry({ id: "w", entry_type: "wanted", occurred_at: "2026-02-10T10:00:00Z", withdrawn_at: "2026-04-01T00:00:00Z" });
    const q = entry({ id: "q", entry_type: "question", occurred_at: "2026-02-20T10:00:00Z" });
    const all = [c, q, w, a, b];
    cases.push({ name: "a withdrawn entry counted as active", ok: activeEntries(all).length === 4 && !activeEntries(all).some((e) => e.id === "w") });
    const position = positionOverTime(all);
    cases.push({ name: "the position view is not the active position entries in time order", ok: position.map((e) => e.id).join(",") === "a,b,c" });
    cases.push({ name: "the position view added something that is not an entry", ok: position.every((e) => all.includes(e)) });

    // The timeline: only real records, withdrawn entries stay, closed state is the current one.
    const open = buildTimeline({ created_at: "2026-02-15T00:00:00Z", status: "open", closed_at: null }, all);
    cases.push({ name: "the timeline is not the item, plus each entry, and nothing else", ok: open.length === 1 + all.length });
    cases.push({
      name: "the timeline is not in time order (a discussion before the item was added comes first)",
      ok: open[0].kind === "entry" && open[0].at === "2026-01-08T10:00:00Z" && open.some((e) => e.kind === "item_added"),
    });
    cases.push({ name: "a withdrawn entry was dropped from the timeline", ok: open.some((e) => e.kind === "entry" && e.entry.id === "w") });
    cases.push({ name: "a withdrawn entry lost its withdrawn mark", ok: open.some((e) => e.kind === "entry" && e.entry.id === "w" && e.entry.withdrawn_at !== null) });
    cases.push({ name: "an open item showed a closed event", ok: !open.some((e) => e.kind === "item_closed") });
    const closed = buildTimeline({ created_at: "2026-02-15T00:00:00Z", status: "closed", closed_at: "2026-04-14T00:00:00Z" }, all);
    cases.push({ name: "a closed item did not end the timeline", ok: closed[closed.length - 1].kind === "item_closed" && closed[closed.length - 1].at === "2026-04-14T00:00:00Z" });
    cases.push({ name: "a closed status without a closing time invented an event", ok: !buildTimeline({ created_at: "2026-02-15T00:00:00Z", status: "closed", closed_at: null }, all).some((e) => e.kind === "item_closed") });

    // Two dates are shown only when they differ.
    cases.push({ name: "a Host note showed two dates", ok: sameMoment("2026-02-01T09:00:00Z", "2026-02-01T09:00:20Z") && !sameMoment("2026-01-08T10:00:00Z", "2026-02-01T09:00:00Z") });

    // The governing statement is verbatim.
    cases.push({
      name: "the governing statement is not verbatim",
      ok:
        GOVERNING_STATEMENT ===
        "AVAIA may create and preserve a longitudinal record of a Host’s expressed understanding, reasoning, choices, questions, and participation in consequential decisions. AVAIA does not independently determine or declare legal capacity or incapacity.",
    });

    const failed = cases.filter((x) => !x.ok).map((x) => x.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated records confirm: every entry type is Host-selected and exactly the approved vocabulary, with no capacity, score or verdict; the Host's own words are kept exactly; a referral field is always labelled From your referral; who was present follows the Room's own seat records; the timeline is built only from real records and keeps withdrawn entries flagged; nothing compares entries; and the governing statement is verbatim.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function continuityRecordChecks(): CheckResult[] {
  return [recordCheck()];
}
