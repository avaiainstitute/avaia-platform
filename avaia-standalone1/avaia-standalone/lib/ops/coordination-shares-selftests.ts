import "server-only";
import type { CoordinationItem } from "@/lib/coordination";
import { buildTimeline, type CoordinationEntry } from "@/lib/coordination-entries";
import {
  DEFAULT_VALID_DAYS,
  FACT_KEYS,
  MAX_VALID_DAYS,
  RECIPIENT_ROLES,
  RECIPIENT_ROLE_LABEL,
  authorizationStatement,
  availableFacts,
  buildHandoffPayload,
  canonicalJson,
  emptyShareInput,
  expiryDateFor,
  includesWithdrawnEntry,
  isRecipientRole,
  parseSharingFlag,
  parseShareInput,
  roleDisplay,
  shareStatus,
  waitingOnForRole,
} from "@/lib/coordination-shares";
import { handoffInvitationEmailHtml, handoffInvitationSubject } from "@/lib/resend";
import { newShareToken, sha256Hex } from "@/lib/ops/coordination-shares";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR SHARE WITH + PROFESSIONAL HANDOFF (Workbook, Phase 3). Simulated records only: nothing is
// read from or written to the database, and nothing is sent. They run the very same rules production runs,
// so if a future change quietly breaks one of these promises the next System Check reports it:
//
//   * nothing is pre-selected and nothing is chosen for the Host; every choice is validated, never coerced;
//   * the authorization statement is the Founder's wording, exactly, with only the blanks filled;
//   * the frozen copy contains only what the Host ticked or typed, the Host's words verbatim, and never a
//     withdrawn entry, a Shared Room entry, another decision's entry, or an entry's present note;
//   * the link token is 192 bits and never equals its stored hash; any change to the content changes the
//     preview hash, so authorization cannot differ from what was previewed;
//   * the share timeline is derived only from the share's own timestamps, and invents nothing;
//   * the email carries only who shared it, that it is a read-only handoff, the expiry and the link;
//   * the launch gate opens only for the exact value "true".
//
// The database half of the promise (no insert or delete for a Host, immutable frozen copy, one-time
// revoke, the two recipient functions, same-nothing for unknown, expired and revoked links, no Room entry)
// is proven against the live catalog by schema_rules in lib/ops/system-truth.ts.

type Case = { name: string; ok: boolean };

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const item = (over: Partial<CoordinationItem> = {}): CoordinationItem => ({
  id: "item-1",
  host_id: "h1",
  kind: "decision",
  title: "Keep the house",
  category: "Family",
  delegation_state: "i_own_and_will_do",
  assigned_to_name: "Sam",
  assigned_to_role: "Brother",
  professional_name: null,
  professional_role: null,
  status: "open",
  waiting_on: null,
  waiting_on_note: null,
  next_action: "Call the attorney",
  due_date: "2026-11-01",
  related_decision_id: null,
  related_conversation_id: null,
  related_referral_id: null,
  related_room_label: null,
  created_at: "2026-01-08T10:00:00Z",
  updated_at: "2026-01-08T10:00:00Z",
  closed_at: null,
  ...over,
});

const entry = (n: number, over: Partial<CoordinationEntry> = {}): CoordinationEntry => ({
  id: ID(n),
  host_id: "h1",
  item_id: "item-1",
  entry_type: "wanted",
  source_kind: "host_note",
  occurred_at: `2026-02-0${n}T10:00:00Z`,
  excerpt: "  I want to keep the house.  ",
  host_note: null,
  conversation_id: null,
  message_id: null,
  referral_id: null,
  referral_field: null,
  referral_index: null,
  room_id: null,
  room_message_id: null,
  room_label: null,
  present_note: "You and AVAIA",
  source_key: null,
  created_at: `2026-02-0${n}T10:00:00Z`,
  withdrawn_at: null,
  ...over,
});

const base = (over: Record<string, unknown> = {}) => ({
  ...emptyShareInput("Keep the house"),
  recipient_name: "Alex",
  recipient_email: "alex@example.com",
  recipient_role: "attorney",
  shared_by_name: "Dana",
  purpose: "Please review",
  fact_keys: ["next_action"],
  ...over,
});

function sharesCheck(): CheckResult {
  const key = "pipeline_share_with";
  const label = "Share With behaves as designed";
  try {
    const cases: Case[] = [];

    // Recipient vocabulary.
    cases.push({
      name: "the recipient roles are not exactly the eight approved",
      ok:
        RECIPIENT_ROLES.length === 8 &&
        ["attorney", "cpa_accountant", "financial_advisor", "insurance_professional", "guide", "family_member", "organizational_contact", "other"].every((r) => isRecipientRole(r)) &&
        RECIPIENT_ROLES.every((r) => RECIPIENT_ROLE_LABEL[r].length > 0),
    });
    cases.push({ name: "an unknown role was accepted", ok: !isRecipientRole("judge") && !isRecipientRole(undefined) });
    cases.push({ name: "the Host's own role wording was not used", ok: roleDisplay("attorney", " estate attorney ") === "estate attorney" && roleDisplay("attorney", "  ") === "Attorney" });
    cases.push({
      name: "the waiting-on mapping is wrong",
      ok:
        waitingOnForRole("attorney") === "professional" &&
        waitingOnForRole("cpa_accountant") === "professional" &&
        waitingOnForRole("guide") === "guide" &&
        waitingOnForRole("family_member") === "family_member" &&
        waitingOnForRole("organizational_contact") === "other" &&
        waitingOnForRole("other") === "other",
    });

    // Nothing pre-selected.
    const blank = emptyShareInput("Keep the house");
    cases.push({
      name: "something was pre-selected for the Host",
      ok:
        blank.fact_keys.length === 0 &&
        blank.entry_ids.length === 0 &&
        blank.summary === "" &&
        blank.open_questions === "" &&
        blank.requested_follow_up === "" &&
        blank.how_to_reach === "" &&
        blank.mark_waiting === false &&
        blank.recipient_name === "" &&
        blank.recipient_email === "" &&
        blank.purpose === "" &&
        blank.valid_days === DEFAULT_VALID_DAYS &&
        DEFAULT_VALID_DAYS === 14 &&
        MAX_VALID_DAYS === 30,
    });

    // Validation: refused, never coerced.
    cases.push({ name: "a valid share did not parse", ok: parseShareInput(base()).ok });
    cases.push({ name: "an empty share was accepted (no facts, entries or text)", ok: !parseShareInput(base({ fact_keys: [] })).ok });
    cases.push({ name: "'how to reach me' alone counted as content", ok: !parseShareInput(base({ fact_keys: [], how_to_reach: "Call me" })).ok });
    cases.push({ name: "typed text alone did not count as content", ok: parseShareInput(base({ fact_keys: [], summary: "A summary." })).ok });
    for (const [name, patch] of [
      ["a missing title", { title: "  " }],
      ["a missing recipient name", { recipient_name: "" }],
      ["a bad email", { recipient_email: "not-an-email" }],
      ["a missing shared-by name", { shared_by_name: "" }],
      ["a missing purpose", { purpose: "" }],
      ["an unknown role", { recipient_role: "judge" }],
      ["the role 'other' without wording", { recipient_role: "other", recipient_role_label: "" }],
      ["a lifetime of 0 days", { valid_days: 0 }],
      ["a lifetime of 31 days", { valid_days: 31 }],
      ["a fractional lifetime", { valid_days: 14.5 }],
      ["a lifetime sent as text", { valid_days: "14" }],
      ["an unknown detail", { fact_keys: ["capacity_score"] }],
      ["an entry id that is not an id", { entry_ids: ["not-an-id"] }],
      ["an over-long summary", { summary: "x".repeat(2001) }],
    ] as [string, Record<string, unknown>][]) {
      cases.push({ name: `${name} was accepted`, ok: !parseShareInput(base(patch)).ok });
    }
    cases.push({ name: "the role 'other' with wording was refused", ok: parseShareInput(base({ recipient_role: "other", recipient_role_label: "my neighbor" })).ok });
    const deduped = parseShareInput(base({ fact_keys: ["next_action", "next_action"], entry_ids: [ID(1), ID(1)] }));
    cases.push({ name: "a repeated choice was kept twice", ok: deduped.ok && deduped.value.fact_keys.length === 1 && deduped.value.entry_ids.length === 1 });

    // The authorization statement, exactly the Founder's, with only the blanks filled.
    const expectedStatement =
      "I am choosing to share the exact content shown above with Alex (Estate attorney) at alex@example.com. " +
      "I understand that this is a read-only copy of what I selected as it stands today. " +
      "Later changes to my Workbook will not change this copy. " +
      "Access will remain available until October 22, 2026 unless I revoke it earlier. " +
      "Revoking access stops future access but does not recall anything the recipient has already read, copied, saved, or printed.";
    cases.push({
      name: "the authorization statement is not the Founder's wording",
      ok: authorizationStatement({ recipientName: "Alex", role: "Estate attorney", email: "alex@example.com", expiresOn: "October 22, 2026" }) === expectedStatement,
    });
    cases.push({
      name: "the authorization statement adds professional-disclaimer language",
      ok: !/legal advice|financial advice|medical|therapy|not a substitute/i.test(expectedStatement),
    });
    cases.push({ name: "the expiry date is not 14 days from the start", ok: expiryDateFor(14, new Date("2026-10-08T12:00:00Z")) === "October 22, 2026" });

    // The frozen copy.
    const it = item();
    const e1 = entry(1);
    const e2 = entry(2, { entry_type: "reasoning", source_kind: "referral_field", excerpt: "The roof is sound.", host_note: "From my referral." });
    const ew = entry(3, { withdrawn_at: "2026-03-01T00:00:00Z" });
    const er = entry(4, { source_kind: "room_message", room_id: ID(90), room_message_id: ID(91), room_label: "A room" });
    const eo = entry(5, { item_id: "item-2" });
    const all = [e2, e1, ew, er, eo];
    const asInput = (patch: Record<string, unknown>) => {
      const p = parseShareInput(base(patch));
      if (!p.ok) throw new Error(p.error);
      return p.value;
    };

    const facts = availableFacts(it).map((f) => f.key);
    cases.push({ name: "the item's real details were not offered", ok: ["category", "delegation", "assigned", "next_action", "due_date", "added_on"].every((k) => facts.includes(k as never)) });
    cases.push({ name: "a detail the item does not have was offered", ok: !facts.includes("professional" as never) && !facts.includes("waiting" as never) && !facts.includes("closed_on" as never) });
    cases.push({ name: "the offered details include something outside the approved list", ok: facts.every((k) => (FACT_KEYS as readonly string[]).includes(k)) });

    const built = buildHandoffPayload({ item: it, entries: all, input: asInput({ fact_keys: ["next_action", "due_date"], entry_ids: [ID(2), ID(1)], summary: "  A short summary.  ", how_to_reach: "" }) });
    cases.push({ name: "a valid frozen copy was not built", ok: built.ok });
    if (built.ok) {
      const p = built.payload;
      cases.push({ name: "an unticked detail was included", ok: Object.keys(p.facts).sort().join(",") === "due_date,next_action" });
      cases.push({ name: "the chosen entries are not in the order they happened", ok: p.entries.map((e) => e.entry_id).join(",") === `${ID(1)},${ID(2)}` });
      cases.push({ name: "the Host's words were not kept exactly", ok: p.entries[0].excerpt === "  I want to keep the house.  " });
      cases.push({ name: "an entry's present note was included", ok: p.entries.every((e) => !("present_note" in e)) });
      cases.push({ name: "a referral field was not labelled From your referral", ok: p.entries[1].source_label === "From your referral" && p.entries[0].source_label !== "From your referral" });
      cases.push({ name: "typed text was not trimmed, or empty text was kept", ok: p.summary === "A short summary." && !("how_to_reach" in p) && !("open_questions" in p) && !("requested_follow_up" in p) });
      cases.push({ name: "the frozen copy is not tied to the Host's title and name", ok: p.title === "Keep the house" && p.shared_by_name === "Dana" && p.purpose === "Please review" && p.recipient.role_label === "Attorney" });
    }
    cases.push({ name: "a withdrawn entry was shared", ok: !buildHandoffPayload({ item: it, entries: all, input: asInput({ entry_ids: [ID(3)] }) }).ok });
    cases.push({ name: "a Shared Room entry was shared", ok: !buildHandoffPayload({ item: it, entries: all, input: asInput({ entry_ids: [ID(4)] }) }).ok });
    cases.push({ name: "another decision's entry was shared", ok: !buildHandoffPayload({ item: it, entries: all, input: asInput({ entry_ids: [ID(5)] }) }).ok });
    cases.push({ name: "an entry that does not exist was shared", ok: !buildHandoffPayload({ item: it, entries: all, input: asInput({ entry_ids: [ID(77)] }) }).ok });
    cases.push({ name: "entries were shared from a plain item", ok: !buildHandoffPayload({ item: item({ kind: "item" }), entries: all, input: asInput({ entry_ids: [ID(1)] }) }).ok });
    cases.push({ name: "a detail the item does not have was shared", ok: !buildHandoffPayload({ item: it, entries: all, input: asInput({ fact_keys: ["professional"] }) }).ok });

    // Hashing and the token.
    cases.push({ name: "the canonical form depends on key order", ok: canonicalJson({ a: 1, b: { c: 2, d: [3, { e: 4, f: 5 }] } }) === canonicalJson({ b: { d: [3, { f: 5, e: 4 }], c: 2 }, a: 1 }) });
    if (built.ok) {
      const stmt = "statement";
      const h1 = sha256Hex(canonicalJson({ payload: built.payload, statement: stmt }));
      const changed = { ...built.payload, summary: "A short summary!" };
      cases.push({ name: "a changed word did not change the preview hash", ok: h1 !== sha256Hex(canonicalJson({ payload: changed, statement: stmt })) });
      cases.push({ name: "a changed statement did not change the preview hash", ok: h1 !== sha256Hex(canonicalJson({ payload: built.payload, statement: "other" })) });
      cases.push({ name: "the same content did not give the same hash", ok: h1 === sha256Hex(canonicalJson({ statement: stmt, payload: built.payload })) });
    }
    const tokens = new Set(Array.from({ length: 25 }, () => newShareToken()));
    const t = [...tokens][0];
    cases.push({ name: "link tokens are not unique, 192-bit and URL-safe", ok: tokens.size === 25 && /^[A-Za-z0-9_-]{32}$/.test(t) });
    cases.push({ name: "the stored hash is not a 64-character fingerprint different from the token", ok: /^[0-9a-f]{64}$/.test(sha256Hex(t)) && sha256Hex(t) !== t });

    // Status and history.
    const now = new Date("2026-04-20T00:00:00Z");
    cases.push({
      name: "a share's status is not derived as active, expired or revoked",
      ok:
        shareStatus({ revoked_at: null, expires_at: "2026-04-30T00:00:00Z" }, now) === "active" &&
        shareStatus({ revoked_at: null, expires_at: "2026-04-16T00:00:00Z" }, now) === "expired" &&
        shareStatus({ revoked_at: "2026-04-08T00:00:00Z", expires_at: "2026-04-30T00:00:00Z" }, now) === "revoked" &&
        shareStatus({ revoked_at: "2026-04-08T00:00:00Z", expires_at: "2026-04-10T00:00:00Z" }, now) === "revoked",
    });
    cases.push({
      name: "a later-withdrawn entry was not noticed in share history",
      ok: includesWithdrawnEntry({ entry_ids: [ID(1), ID(3)] }, [e1, ew]) && !includesWithdrawnEntry({ entry_ids: [ID(1)] }, [e1, ew]),
    });

    // The timeline, derived from the share's own timestamps only.
    const sentViewedRevoked = {
      id: "s1",
      recipientLabel: "Alex (Estate attorney)",
      authorized_at: "2026-04-02T00:00:00Z",
      expires_at: "2026-04-16T00:00:00Z",
      revoked_at: "2026-04-08T00:00:00Z",
      first_viewed_at: "2026-04-04T00:00:00Z",
    };
    const open = { created_at: "2026-01-08T10:00:00Z", status: "open" as const, closed_at: null };
    const kinds = (shares: Parameters<typeof buildTimeline>[2]) => buildTimeline(open, [], shares, now).map((e) => e.kind).join(",");
    cases.push({ name: "sent, first viewed, revoked were not derived in order", ok: kinds([sentViewedRevoked]) === "item_added,share_sent,share_viewed,share_revoked" });
    cases.push({ name: "an expiry was invented for a share revoked before it would expire", ok: !kinds([sentViewedRevoked]).includes("share_expired") });
    cases.push({
      name: "an expiry was not derived for an unrevoked share whose time passed",
      ok: kinds([{ ...sentViewedRevoked, revoked_at: null }]) === "item_added,share_sent,share_viewed,share_expired",
    });
    cases.push({ name: "an expiry was shown for a share still active", ok: !kinds([{ ...sentViewedRevoked, revoked_at: null, expires_at: "2026-05-30T00:00:00Z" }]).includes("share_expired") });
    cases.push({ name: "a view was invented for a share nobody opened", ok: !kinds([{ ...sentViewedRevoked, first_viewed_at: null }]).includes("share_viewed") });
    cases.push({ name: "the timeline changed when there are no shares", ok: kinds([]) === "item_added" && kinds(undefined) === "item_added" });

    // The email.
    const html = handoffInvitationEmailHtml({ sharedByName: "Dana <b>Smith</b>", url: "https://example.org/handoff/abc", expiresOn: "October 22, 2026" });
    cases.push({ name: "the subject is not '[Name] has shared something with you through AVAIA.'", ok: handoffInvitationSubject("Dana") === "Dana has shared something with you through AVAIA." });
    cases.push({ name: "a name was allowed to add a line to the subject", ok: !handoffInvitationSubject("Dana\r\nBcc: x@y.z").includes("\n") });
    cases.push({ name: "the email lacks the sharer, expiry or link", ok: html.includes("has shared a read-only AVAIA handoff with you") && html.includes("October 22, 2026") && html.includes("https://example.org/handoff/abc") });
    cases.push({ name: "the email did not tell the recipient to ignore it if unexpected", ok: html.includes("you can ignore this email") });
    cases.push({ name: "a typed name was not escaped in the email", ok: !html.includes("<b>Smith</b>") && html.includes("&lt;b&gt;Smith&lt;/b&gt;") });
    cases.push({ name: "the email carries a title, purpose or content", ok: !/title|purpose|excerpt|summary|decision/i.test(html) });

    // The launch gate.
    cases.push({
      name: "the launch gate opens for something other than exactly 'true'",
      ok: parseSharingFlag("true") && !parseSharingFlag("TRUE") && !parseSharingFlag("1") && !parseSharingFlag("yes") && !parseSharingFlag("") && !parseSharingFlag(undefined),
    });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated records confirm: nothing is pre-selected; every choice is validated, never coerced; the authorization statement is the Founder's wording exactly; the frozen copy holds only what the Host ticked or typed, with their words verbatim, and never a withdrawn, Shared Room, other-decision or present-note entry; link tokens are 192-bit and distinct from their hashes; any change alters the preview hash; the share timeline is derived only from the share's own timestamps; the email carries no content; and the launch gate opens only for exactly 'true'.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function shareWithChecks(): CheckResult[] {
  return [sharesCheck()];
}
