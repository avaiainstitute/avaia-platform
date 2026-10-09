// GUIDE COORDINATION (Workbook, Phase 4): the rules. Decision 0011.
//
// A Host can give ONE eligible Guide a time-limited, revocable window onto the coordination items (and,
// separately, the continuity entries) the Host chooses. Nothing is included by default. The Guide reads a
// curated view and records Guide-authored notes and follow-up marks. The Guide can change nothing the Host
// owns, and nothing a Guide records is ever the Host's words, part of the continuity record, or part of a
// Phase 3 share.
//
// Pure rules only (no I/O), so the System Check self-test runs the very same functions production uses.
// The database half of every promise (the Guide has no table access, a grant can't be edited, one live grant
// per Guide, etc.) lives in migrations 0123 and 0124 and is proven against the live catalog by lib/ops/system-truth.ts.

import { isUuid } from "@/lib/coordination";
import { expiryDateFor, isRecipientRole, roleDisplay } from "@/lib/coordination-shares";

// ---- The launch gate ----------------------------------------------------------------------------

/** The gate is open only for the exact lowercase value "true". Anything else, including absent, is closed. */
export function parseGuideFlag(value: string | undefined): boolean {
  return value === "true";
}

// ---- Grant duration (Founder decision 3) -------------------------------------------------------

export const GRANT_DAYS = { min: 1, max: 90, default: 30 } as const;

export const GUIDE_LIMITS = { body: 2000, hostLabel: 200 } as const;

// ---- What a Guide may record ---------------------------------------------------------------------

export const GUIDE_EVENT_KINDS = [
  "note",
  "followup_done",
  "contacted_professional",
  "reviewed_with_host",
  "waiting_on_host",
  "flag_attention",
] as const;
export type GuideEventKind = (typeof GUIDE_EVENT_KINDS)[number];

export function isGuideEventKind(v: unknown): v is GuideEventKind {
  return typeof v === "string" && (GUIDE_EVENT_KINDS as readonly string[]).includes(v);
}

/** How each kind reads to the Guide who records it, and to the Host who reads it. These document Guide
 *  activity only: none of them changes the Host's status, waiting-on, next action, due date or delegation. */
export const GUIDE_EVENT_LABEL_FOR_GUIDE: Record<GuideEventKind, string> = {
  note: "A note",
  followup_done: "Follow-up completed",
  contacted_professional: "Contacted a professional",
  reviewed_with_host: "Reviewed with the Host",
  waiting_on_host: "Waiting on the Host",
  flag_attention: "Flag for the Host's attention",
};
export const GUIDE_EVENT_LABEL_FOR_HOST: Record<GuideEventKind, string> = {
  note: "Guide note",
  followup_done: "Follow-up completed",
  contacted_professional: "Contacted a professional",
  reviewed_with_host: "Reviewed with you",
  waiting_on_host: "Waiting on you",
  flag_attention: "Flagged for your attention",
};

/** A note and a flag must say something; the follow-up marks need no words. */
export function guideEventNeedsBody(kind: GuideEventKind): boolean {
  return kind === "note" || kind === "flag_attention";
}

type Raw = Record<string, FormDataEntryValue | null | undefined>;
const text = (raw: Raw, key: string): string => {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
};

export type GuideEventInput = { kind: GuideEventKind; body: string | null };

/** What the Guide chose and typed. Nothing is defaulted or generated. */
export function parseGuideEventInput(raw: Raw): { ok: true; value: GuideEventInput } | { ok: false; error: string } {
  const kind = text(raw, "kind");
  if (!isGuideEventKind(kind)) return { ok: false, error: "Choose what you are recording." };
  const body = text(raw, "body");
  if (body.length > GUIDE_LIMITS.body) return { ok: false, error: `That is too long. The limit is ${GUIDE_LIMITS.body} characters.` };
  if (guideEventNeedsBody(kind) && body.length === 0) return { ok: false, error: "Write what you want to record." };
  return { ok: true, value: { kind, body: body.length > 0 ? body : null } };
}

// ---- What a Host authorizes ----------------------------------------------------------------------

export type GuideGrantInput = {
  guide_id: string;
  host_label: string;
  valid_days: number;
  item_ids: string[];
  entry_ids: string[];
};

/** The Host's choices, validated and never coerced. A duplicate id is collapsed; an invalid one is refused. */
export function parseGuideGrantInput(raw: {
  guide_id?: unknown;
  host_label?: unknown;
  valid_days?: unknown;
  item_ids?: unknown;
  entry_ids?: unknown;
}): { ok: true; value: GuideGrantInput } | { ok: false; error: string } {
  const guide = typeof raw.guide_id === "string" ? raw.guide_id.trim() : "";
  if (!isUuid(guide)) return { ok: false, error: "Choose a Guide." };
  const label = typeof raw.host_label === "string" ? raw.host_label.trim() : "";
  if (label.length === 0) return { ok: false, error: "Write the name you want your Guide to see for you." };
  if (label.length > GUIDE_LIMITS.hostLabel) return { ok: false, error: `That name can be up to ${GUIDE_LIMITS.hostLabel} characters.` };
  const daysRaw = typeof raw.valid_days === "string" ? raw.valid_days.trim() : typeof raw.valid_days === "number" ? String(raw.valid_days) : "";
  const days = daysRaw === "" ? GRANT_DAYS.default : Number(daysRaw);
  if (!Number.isInteger(days) || days < GRANT_DAYS.min || days > GRANT_DAYS.max) {
    return { ok: false, error: `Choose a length of ${GRANT_DAYS.min} to ${GRANT_DAYS.max} days.` };
  }
  const ids = (v: unknown): string[] | null => {
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) return null;
    const out: string[] = [];
    for (const x of v) {
      if (typeof x !== "string" || !isUuid(x)) return null;
      if (!out.includes(x)) out.push(x);
    }
    return out;
  };
  const itemIds = ids(raw.item_ids);
  const entryIds = ids(raw.entry_ids);
  if (itemIds === null || entryIds === null) return { ok: false, error: "One of the choices was not valid. Please try again." };
  if (itemIds.length === 0) return { ok: false, error: "Choose at least one item for your Guide to see." };
  return { ok: true, value: { guide_id: guide, host_label: label, valid_days: days, item_ids: itemIds, entry_ids: entryIds } };
}

/** The Host's authorization, stored verbatim with the grant. The wording is a DRAFT until the Founder
 *  approves it (Decision 0011). */
export function guideGrantStatement(args: { guideName: string; endsOn: string }): string {
  return (
    `I am choosing to let ${args.guideName} see the items and entries I have selected, including the people I have named on those items, until ${args.endsOn}, unless I revoke access sooner. ` +
    `They can record notes and follow-up marks about these items. They cannot change my decisions, my entries, who carries what, or anything I share. ` +
    `Revoking stops their access from that moment. It does not erase notes they have already recorded, and it does not recall anything they have already read.`
  );
}

/** The end date a grant of this many days would have, as the Host will see it. */
export function grantEndsOn(days: number, now: Date = new Date()): string {
  return expiryDateFor(days, now);
}

// ---- Records ---------------------------------------------------------------------------------------

export type GuideGrant = {
  id: string;
  host_id: string;
  guide_id: string;
  host_label: string;
  authorization_statement: string;
  granted_at: string;
  valid_days: number;
  ends_at: string;
  revoked_at: string | null;
};

export type GuideScopeRow = {
  id: string;
  grant_id: string;
  host_id: string;
  item_id: string;
  entry_id: string | null;
  added_at: string;
  removed_at: string | null;
};

export type GuideEvent = {
  id: string;
  grant_id: string;
  host_id: string;
  guide_id: string;
  item_id: string;
  kind: GuideEventKind;
  body: string | null;
  created_at: string;
  withdrawn_at: string | null;
  acknowledged_at: string | null;
};

export type GrantStatus = "active" | "expired" | "revoked";
export const GRANT_STATUS_LABEL: Record<GrantStatus, string> = { active: "Active", expired: "Ended (time ran out)", revoked: "Revoked" };

/** Revoked wins. Otherwise it is active until its end time, then ended. Never inferred from anything else. */
export function grantStatus(g: Pick<GuideGrant, "revoked_at" | "ends_at">, now: Date = new Date()): GrantStatus {
  if (g.revoked_at) return "revoked";
  return Date.parse(g.ends_at) > now.getTime() ? "active" : "expired";
}

/** The scope a Host currently has for one grant: the live item rows and the live entry rows. */
export function currentScope(rows: GuideScopeRow[], grantId: string): { itemIds: Set<string>; entryIds: Set<string> } {
  const itemIds = new Set<string>();
  const entryIds = new Set<string>();
  for (const r of rows) {
    if (r.grant_id !== grantId || r.removed_at !== null) continue;
    if (r.entry_id === null) itemIds.add(r.item_id);
    else entryIds.add(r.entry_id);
  }
  return { itemIds, entryIds };
}

export type ScopeDiff = { addItems: string[]; removeItems: string[]; addEntries: string[]; removeEntries: string[] };

/** What has to change to turn the current scope into the Host's new choice. An entry can only be chosen
 *  while its item is chosen; an entry whose item is being removed is dropped by the database along with it. */
export function diffScope(
  current: { itemIds: Set<string>; entryIds: Set<string> },
  wanted: { itemIds: string[]; entryIds: string[]; entryItem: (entryId: string) => string | null }
): ScopeDiff {
  const wantItems = new Set(wanted.itemIds);
  const wantEntries = new Set(wanted.entryIds.filter((e) => {
    const item = wanted.entryItem(e);
    return item !== null && wantItems.has(item);
  }));
  return {
    addItems: Array.from(wantItems).filter((i) => !current.itemIds.has(i)),
    removeItems: Array.from(current.itemIds).filter((i) => !wantItems.has(i)),
    addEntries: Array.from(wantEntries).filter((e) => !current.entryIds.has(e)),
    removeEntries: Array.from(current.entryIds).filter((e) => !wantEntries.has(e)),
  };
}

// ---- The Guide's view (what the database function returns) -----------------------------------------

export type GuideViewEntry = {
  id: string;
  entry_type: string;
  source_kind: string;
  occurred_at: string;
  withdrawn: boolean;
  withdrawn_at: string | null;
  excerpt: string | null;
  host_note: string | null;
};
export type GuideViewHandoff = {
  recipient_role: string;
  recipient_role_label: string | null;
  authorized_at: string;
  expires_at: string;
  status: "active" | "revoked" | "expired";
  viewed: boolean;
};
export type GuideViewEvent = {
  id: string;
  kind: GuideEventKind;
  body: string | null;
  created_at: string;
  withdrawn_at: string | null;
  acknowledged_at: string | null;
};
export type GuideViewItem = {
  id: string;
  kind: "item" | "decision";
  title: string;
  category: string | null;
  status: "open" | "waiting" | "closed";
  waiting_on: string | null;
  waiting_on_note: string | null;
  delegation_state: string | null;
  assigned_to_name: string | null;
  assigned_to_role: string | null;
  professional_name: string | null;
  professional_role: string | null;
  next_action: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  related_decision_title: string | null;
  entries: GuideViewEntry[];
  handoffs: GuideViewHandoff[];
  events: GuideViewEvent[];
};
export type GuideView = {
  grant: { id: string; host_label: string; granted_at: string; ends_at: string };
  items: GuideViewItem[];
};
export type GuideHostSummary = {
  grant_id: string;
  host_label: string;
  granted_at: string;
  ends_at: string;
  item_count: number;
  waiting_on_guide_count: number;
  next_due: string | null;
  open_flags: number;
};

/** How a handoff's recipient role reads to a Guide: the Host's own wording if given, else the controlled label.
 *  Never a name or an email: the database does not return them. */
export function handoffRoleLabel(h: Pick<GuideViewHandoff, "recipient_role" | "recipient_role_label">): string {
  return isRecipientRole(h.recipient_role) ? roleDisplay(h.recipient_role, h.recipient_role_label) : "A professional";
}

export const HANDOFF_STATUS_LABEL: Record<GuideViewHandoff["status"], string> = { active: "Active", revoked: "Revoked", expired: "Ended" };
