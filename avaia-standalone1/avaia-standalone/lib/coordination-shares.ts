// SHARE WITH + PROFESSIONAL HANDOFF (Workbook, Phase 3): the rules. Decision 0010.
//
// A Host shares ONE item with ONE named person as a FROZEN copy of exactly what they approved. The
// recipient reads that copy on a read-only page; they never see the Host's live records. Later changes
// to the Workbook, the item, an entry, a note, a position or a delegation never change a share that
// already exists.
//
// What this file is, and is not:
//   * Nothing is pre-selected and nothing is inferred or chosen by AI. Every fact, every entry and every
//     word of the handoff is what the Host ticked or typed.
//   * Pure rules only (no I/O, and no crypto, so the browser composer can import it). The token and
//     hashing live in lib/ops/coordination-shares.ts. The System Check self-test runs these same
//     functions production uses.
//   * Shared Room entries and withdrawn entries can never be shared (Decision 0010; the database
//     enforces it too). An entry's "present note" is never shared.

import {
  DELEGATION_LABEL,
  WAITING_ON_LABEL,
  isUuid,
  type CoordinationItem,
  type WaitingOn,
} from "@/lib/coordination";
import { ENTRY_TYPE_LABEL, SOURCE_LABEL, type CoordinationEntry } from "@/lib/coordination-entries";

export const RECIPIENT_ROLES = [
  "attorney",
  "cpa_accountant",
  "financial_advisor",
  "insurance_professional",
  "guide",
  "family_member",
  "organizational_contact",
  "other",
] as const;
export type RecipientRole = (typeof RECIPIENT_ROLES)[number];

export const RECIPIENT_ROLE_LABEL: Record<RecipientRole, string> = {
  attorney: "Attorney",
  cpa_accountant: "CPA / accountant",
  financial_advisor: "Financial advisor",
  insurance_professional: "Insurance professional",
  guide: "Guide",
  family_member: "Family member",
  organizational_contact: "Employer or organizational contact",
  other: "Other",
};

export function isRecipientRole(v: unknown): v is RecipientRole {
  return typeof v === "string" && (RECIPIENT_ROLES as readonly string[]).includes(v);
}

/** How a recipient's role reads: the Host's own wording if they gave one, else the controlled label. */
export function roleDisplay(role: RecipientRole, label: string | null | undefined): string {
  const custom = (label ?? "").trim();
  return custom.length > 0 ? custom : RECIPIENT_ROLE_LABEL[role];
}

/** The existing Phase 1 "Waiting on" value a share can offer to set, when the Host chooses to. */
export function waitingOnForRole(role: RecipientRole): WaitingOn {
  if (role === "guide") return "guide";
  if (role === "family_member") return "family_member";
  if (role === "organizational_contact" || role === "other") return "other";
  return "professional";
}

export const DEFAULT_VALID_DAYS = 14;
export const MAX_VALID_DAYS = 30;

export const SHARE_LIMITS = {
  title: 200,
  name: 200,
  email: 320,
  purpose: 500,
  roleLabel: 100,
  longText: 2000,
  howToReach: 500,
  maxEntries: 100,
} as const;

/** The item details a Host can choose to share, in the fixed order they are shown. */
export const FACT_KEYS = [
  "category",
  "delegation",
  "assigned",
  "professional",
  "waiting",
  "next_action",
  "due_date",
  "added_on",
  "closed_on",
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export type AvailableFact = { key: FactKey; label: string; value: string };

/** A real calendar date, in UTC, for text the Host sees and text frozen into a share. */
export function formatLongDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const joinPair = (a: string | null, b: string | null) => [a, b].filter((x): x is string => !!x && x.trim().length > 0).join(", ");

/** The details this item actually has, each ready to be ticked. Empty ones are not offered. */
export function availableFacts(item: CoordinationItem): AvailableFact[] {
  const facts: AvailableFact[] = [];
  if (item.category) facts.push({ key: "category", label: "Category", value: item.category });
  if (item.delegation_state) facts.push({ key: "delegation", label: "Who carries this", value: DELEGATION_LABEL[item.delegation_state] });
  const helper = joinPair(item.assigned_to_name, item.assigned_to_role);
  if (helper) facts.push({ key: "assigned", label: "Person helping", value: helper });
  const pro = joinPair(item.professional_name, item.professional_role);
  if (pro) facts.push({ key: "professional", label: "Professional involved", value: pro });
  if (item.status === "waiting" && item.waiting_on) {
    const note = item.waiting_on_note ? `: ${item.waiting_on_note}` : "";
    facts.push({ key: "waiting", label: "Waiting on", value: `${WAITING_ON_LABEL[item.waiting_on]}${note}` });
  }
  if (item.next_action) facts.push({ key: "next_action", label: "Next action", value: item.next_action });
  if (item.due_date) facts.push({ key: "due_date", label: "Due or follow up", value: formatLongDate(`${item.due_date}T00:00:00Z`) });
  facts.push({ key: "added_on", label: "Added to the Host's Coordination", value: formatLongDate(item.created_at) });
  if (item.status === "closed" && item.closed_at) facts.push({ key: "closed_on", label: "Closed", value: formatLongDate(item.closed_at) });
  return facts;
}

/** Everything the Host chooses in the compose step. Nothing here is defaulted on the Host's behalf. */
export type ShareInput = {
  title: string;
  recipient_name: string;
  recipient_email: string;
  recipient_role: RecipientRole;
  recipient_role_label: string;
  shared_by_name: string;
  purpose: string;
  valid_days: number;
  fact_keys: FactKey[];
  entry_ids: string[];
  summary: string;
  open_questions: string;
  requested_follow_up: string;
  how_to_reach: string;
  mark_waiting: boolean;
};

/** A blank form. Nothing is pre-selected: no facts, no entries, no text. Only the item's own title
 *  is offered as the starting title, and the Host can change it. */
export function emptyShareInput(title: string): ShareInput {
  return {
    title,
    recipient_name: "",
    recipient_email: "",
    recipient_role: "attorney",
    recipient_role_label: "",
    shared_by_name: "",
    purpose: "",
    valid_days: DEFAULT_VALID_DAYS,
    fact_keys: [],
    entry_ids: [],
    summary: "",
    open_questions: "",
    requested_follow_up: "",
    how_to_reach: "",
    mark_waiting: false,
  };
}

type Parsed = { ok: true; value: ShareInput } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(raw: Record<string, unknown>, key: string): string {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
}

/** What the browser sent, checked. Unknown or malformed values are refused, never coerced. */
export function parseShareInput(raw: unknown): Parsed {
  if (!raw || typeof raw !== "object") return { ok: false, error: "That could not be read. Please try again." };
  const r = raw as Record<string, unknown>;

  const title = str(r, "title");
  if (title.length === 0) return { ok: false, error: "Give this share a title." };
  if (title.length > SHARE_LIMITS.title) return { ok: false, error: `The title can be up to ${SHARE_LIMITS.title} characters.` };

  const recipientName = str(r, "recipient_name");
  if (recipientName.length === 0) return { ok: false, error: "Enter the recipient's name." };
  if (recipientName.length > SHARE_LIMITS.name) return { ok: false, error: `The name can be up to ${SHARE_LIMITS.name} characters.` };

  const email = str(r, "recipient_email");
  if (email.length > SHARE_LIMITS.email || !EMAIL.test(email)) return { ok: false, error: "Enter a valid email address for the recipient." };

  const role = r.recipient_role;
  if (!isRecipientRole(role)) return { ok: false, error: "Choose the recipient's role." };
  const roleLabel = str(r, "recipient_role_label");
  if (roleLabel.length > SHARE_LIMITS.roleLabel) return { ok: false, error: `The role wording can be up to ${SHARE_LIMITS.roleLabel} characters.` };
  if (role === "other" && roleLabel.length === 0) return { ok: false, error: "Say in your own words who this is." };

  const sharedBy = str(r, "shared_by_name");
  if (sharedBy.length === 0) return { ok: false, error: "Enter the name you want the recipient to see." };
  if (sharedBy.length > SHARE_LIMITS.name) return { ok: false, error: `That name can be up to ${SHARE_LIMITS.name} characters.` };

  const purpose = str(r, "purpose");
  if (purpose.length === 0) return { ok: false, error: "Say why you are sharing this." };
  if (purpose.length > SHARE_LIMITS.purpose) return { ok: false, error: `The purpose can be up to ${SHARE_LIMITS.purpose} characters.` };

  const days = r.valid_days;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MAX_VALID_DAYS) {
    return { ok: false, error: `Choose how long the link lasts: 1 to ${MAX_VALID_DAYS} days.` };
  }

  const factsRaw = Array.isArray(r.fact_keys) ? r.fact_keys : [];
  const facts: FactKey[] = [];
  for (const k of factsRaw) {
    if (typeof k !== "string" || !(FACT_KEYS as readonly string[]).includes(k)) return { ok: false, error: "One of the details you chose is not available." };
    if (!facts.includes(k as FactKey)) facts.push(k as FactKey);
  }

  const idsRaw = Array.isArray(r.entry_ids) ? r.entry_ids : [];
  const ids: string[] = [];
  for (const id of idsRaw) {
    if (!isUuid(id)) return { ok: false, error: "One of the entries you chose could not be found." };
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > SHARE_LIMITS.maxEntries) return { ok: false, error: `You can share up to ${SHARE_LIMITS.maxEntries} entries at a time.` };

  const long = (key: string, label: string): { ok: true; v: string } | { ok: false; error: string } => {
    const v = str(r, key);
    return v.length > SHARE_LIMITS.longText ? { ok: false, error: `${label} can be up to ${SHARE_LIMITS.longText} characters.` } : { ok: true, v };
  };
  const summary = long("summary", "Your summary");
  if (!summary.ok) return summary;
  const questions = long("open_questions", "Your open questions");
  if (!questions.ok) return questions;
  const followUp = long("requested_follow_up", "The requested follow-up");
  if (!followUp.ok) return followUp;
  const reach = str(r, "how_to_reach");
  if (reach.length > SHARE_LIMITS.howToReach) return { ok: false, error: `"How to reach me" can be up to ${SHARE_LIMITS.howToReach} characters.` };

  if (facts.length === 0 && ids.length === 0 && !summary.v && !questions.v && !followUp.v) {
    return { ok: false, error: "Choose something to share beyond the title." };
  }

  return {
    ok: true,
    value: {
      title,
      recipient_name: recipientName,
      recipient_email: email,
      recipient_role: role,
      recipient_role_label: roleLabel,
      shared_by_name: sharedBy,
      purpose,
      valid_days: days,
      fact_keys: facts,
      entry_ids: ids,
      summary: summary.v,
      open_questions: questions.v,
      requested_follow_up: followUp.v,
      how_to_reach: reach,
      mark_waiting: r.mark_waiting === true,
    },
  };
}

// ---- The frozen copy ----------------------------------------------------------------------------

export type HandoffEntry = {
  entry_id: string;
  entry_type: string;
  entry_type_label: string;
  source_kind: string;
  source_label: string;
  occurred_at: string;
  excerpt: string;
  host_note: string | null;
};

export type HandoffPayload = {
  version: 1;
  title: string;
  shared_by_name: string;
  purpose: string;
  recipient: { name: string; role_label: string };
  summary?: string;
  open_questions?: string;
  requested_follow_up?: string;
  how_to_reach?: string;
  facts: Record<string, { label: string; value: string }>;
  entries: HandoffEntry[];
};

/** Builds exactly what the recipient will see, from the Host's choices and the real records. Refuses
 *  anything that must never be shared. The browser never supplies content that has a source. */
export function buildHandoffPayload(args: {
  item: CoordinationItem;
  entries: CoordinationEntry[];
  input: ShareInput;
}): { ok: true; payload: HandoffPayload } | { ok: false; error: string } {
  const { item, entries, input } = args;

  if (input.entry_ids.length > 0 && item.kind !== "decision") return { ok: false, error: "Entries can be shared only from a decision." };

  const chosen: CoordinationEntry[] = [];
  for (const id of input.entry_ids) {
    const entry = entries.find((e) => e.id === id && e.item_id === item.id);
    if (!entry) return { ok: false, error: "One of the entries you chose could not be found." };
    if (entry.withdrawn_at) return { ok: false, error: "A withdrawn entry cannot be shared. Restore it first, or leave it out." };
    if (entry.source_kind === "room_message") return { ok: false, error: "Words from a Shared Room can't be shared outside AVAIA." };
    chosen.push(entry);
  }
  chosen.sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || Date.parse(a.created_at) - Date.parse(b.created_at));

  const offered = availableFacts(item);
  const facts: Record<string, { label: string; value: string }> = {};
  for (const key of FACT_KEYS) {
    if (!input.fact_keys.includes(key)) continue;
    const fact = offered.find((f) => f.key === key);
    if (!fact) return { ok: false, error: "One of the details you chose is not on this item." };
    facts[key] = { label: fact.label, value: fact.value };
  }

  const payload: HandoffPayload = {
    version: 1,
    title: input.title,
    shared_by_name: input.shared_by_name,
    purpose: input.purpose,
    recipient: { name: input.recipient_name, role_label: roleDisplay(input.recipient_role, input.recipient_role_label) },
    facts,
    entries: chosen.map((e) => ({
      entry_id: e.id,
      entry_type: e.entry_type,
      entry_type_label: ENTRY_TYPE_LABEL[e.entry_type],
      source_kind: e.source_kind,
      source_label: SOURCE_LABEL[e.source_kind],
      occurred_at: e.occurred_at,
      excerpt: e.excerpt,
      host_note: e.host_note,
    })),
  };
  if (input.summary) payload.summary = input.summary;
  if (input.open_questions) payload.open_questions = input.open_questions;
  if (input.requested_follow_up) payload.requested_follow_up = input.requested_follow_up;
  if (input.how_to_reach) payload.how_to_reach = input.how_to_reach;
  return { ok: true, payload };
}

/** Stable text for hashing: keys sorted at every level, arrays kept in order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** The Founder's authorization statement (Decision 0010), exactly, with the three blanks filled. It is
 *  stored with the share, so "what they authorized" survives any later change to the wording. */
export function authorizationStatement(args: { recipientName: string; role: string; email: string; expiresOn: string }): string {
  return (
    `I am choosing to share the exact content shown above with ${args.recipientName} (${args.role}) at ${args.email}. ` +
    `I understand that this is a read-only copy of what I selected as it stands today. ` +
    `Later changes to my Workbook will not change this copy. ` +
    `Access will remain available until ${args.expiresOn} unless I revoke it earlier. ` +
    `Revoking access stops future access but does not recall anything the recipient has already read, copied, saved, or printed.`
  );
}

/** The end date a link with this lifetime would have, as the Host sees it. */
export function expiryDateFor(validDays: number, now: Date = new Date()): string {
  return formatLongDate(new Date(now.getTime() + validDays * 24 * 3600 * 1000));
}

// ---- Share records ------------------------------------------------------------------------------

export type CoordinationShare = {
  id: string;
  host_id: string;
  item_id: string;
  title: string;
  shared_by_name: string;
  recipient_name: string;
  recipient_email: string;
  recipient_role: RecipientRole;
  recipient_role_label: string | null;
  purpose: string;
  payload: HandoffPayload;
  payload_hash: string;
  entry_ids: string[];
  authorization_statement: string;
  authorized_at: string;
  valid_days: number;
  expires_at: string;
  email_status: "pending" | "sent" | "failed";
  revoked_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
};

export type ShareStatus = "active" | "expired" | "revoked";

/** Derived, never stored. Revoked wins; otherwise expired once the time has passed. */
export function shareStatus(share: Pick<CoordinationShare, "revoked_at" | "expires_at">, now: Date = new Date()): ShareStatus {
  if (share.revoked_at) return "revoked";
  return Date.parse(share.expires_at) <= now.getTime() ? "expired" : "active";
}
export const SHARE_STATUS_LABEL: Record<ShareStatus, string> = { active: "Active", expired: "Expired", revoked: "Revoked" };

export const EMAIL_STATUS_LABEL: Record<CoordinationShare["email_status"], string> = {
  pending: "Not yet sent",
  sent: "Email sent",
  failed: "Email could not be sent",
};

/** Whether a share that was already sent contains an entry the Host has since withdrawn. The sent copy
 *  is unchanged; this only lets the history say so. */
export function includesWithdrawnEntry(
  share: Pick<CoordinationShare, "entry_ids">,
  entries: Pick<CoordinationEntry, "id" | "withdrawn_at">[]
): boolean {
  return share.entry_ids.some((id) => entries.some((e) => e.id === id && e.withdrawn_at !== null));
}

/** The environment switch that keeps outward sharing closed until the end-to-end flow is exercised. */
export function parseSharingFlag(value: string | undefined): boolean {
  return value === "true";
}
