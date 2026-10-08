// COORDINATION (Workbook, Phase 1): the rules for the Host's own coordination items.
//
// Decision 0008: AVAIA may create and preserve a longitudinal record of a Host's expressed
// understanding, reasoning, choices, questions, and participation in consequential decisions.
// AVAIA does not independently determine or declare legal capacity or incapacity.
//
// What this file is, and is not:
//   * Every state here (delegation, status, waiting on) is chosen by the Host. Nothing in this
//     file, or in anything that uses it, infers, scores or generates a state, and there is no
//     capacity field of any kind. Green/Yellow/Red (Decision 0001) is not used here.
//   * Pure rules only (no I/O), so the System Check self-test runs the very same functions
//     production uses.
//   * Phase 1 only. `kind = 'decision'` reserves a place for the Decision and Capacity
//     Continuity record; none of that record is built here.

export const COORDINATION_KINDS = ["item", "decision"] as const;
export type CoordinationKind = (typeof COORDINATION_KINDS)[number];
export const COORDINATION_KIND_LABEL: Record<CoordinationKind, string> = {
  item: "Something to coordinate",
  decision: "A decision I am working through",
};

/** The Host's own words for who carries this. Selected by the Host; never inferred. */
export const DELEGATION_STATES = [
  "i_own_and_will_do",
  "i_own_decision_others_carry_out",
  "someone_else_owns",
  "belongs_with_professional",
  "can_wait",
  "need_help_before_deciding",
  "no_capacity_now",
] as const;
export type DelegationState = (typeof DELEGATION_STATES)[number];
export const DELEGATION_LABEL: Record<DelegationState, string> = {
  i_own_and_will_do: "I own this and will do it.",
  i_own_decision_others_carry_out: "I own the decision but someone else can carry it out.",
  someone_else_owns: "Someone else can own this responsibility.",
  belongs_with_professional: "This belongs with a professional.",
  can_wait: "This can wait.",
  need_help_before_deciding: "I need help before deciding.",
  no_capacity_now: "I do not currently have capacity to address this.",
};

export const COORDINATION_STATUSES = ["open", "waiting", "closed"] as const;
export type CoordinationStatus = (typeof COORDINATION_STATUSES)[number];
export const STATUS_LABEL: Record<CoordinationStatus, string> = {
  open: "Open",
  waiting: "Waiting",
  closed: "Closed",
};

export const WAITING_ON_VALUES = ["host", "guide", "family_member", "professional", "other"] as const;
export type WaitingOn = (typeof WAITING_ON_VALUES)[number];
export const WAITING_ON_LABEL: Record<WaitingOn, string> = {
  host: "Me",
  guide: "My Guide",
  family_member: "A family member",
  professional: "A professional",
  other: "Someone or something else",
};

export const LIMITS = {
  title: 200,
  category: 80,
  assignedName: 200,
  assignedRole: 100,
  professionalName: 200,
  professionalRole: 100,
  waitingNote: 500,
  nextAction: 1000,
  roomLabel: 200,
} as const;

/** One row of public.coordination_items, as the application sees it. */
export type CoordinationItem = {
  id: string;
  host_id: string;
  kind: CoordinationKind;
  title: string;
  category: string | null;
  delegation_state: DelegationState | null;
  assigned_to_name: string | null;
  assigned_to_role: string | null;
  professional_name: string | null;
  professional_role: string | null;
  status: CoordinationStatus;
  waiting_on: WaitingOn | null;
  waiting_on_note: string | null;
  next_action: string | null;
  due_date: string | null;
  related_decision_id: string | null;
  related_conversation_id: string | null;
  related_referral_id: string | null;
  related_room_label: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

/** What a Host can set. Deliberately has no capacity, score, colour or inferred field. */
export type CoordinationInput = {
  kind: CoordinationKind;
  title: string;
  category: string | null;
  delegation_state: DelegationState | null;
  assigned_to_name: string | null;
  assigned_to_role: string | null;
  professional_name: string | null;
  professional_role: string | null;
  status: CoordinationStatus;
  waiting_on: WaitingOn | null;
  waiting_on_note: string | null;
  next_action: string | null;
  due_date: string | null;
  related_decision_id: string | null;
  related_room_label: string | null;
};

type Raw = Record<string, FormDataEntryValue | null | undefined>;
type Parsed = { ok: true; value: CoordinationInput } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function isDelegationState(v: unknown): v is DelegationState {
  return typeof v === "string" && (DELEGATION_STATES as readonly string[]).includes(v);
}
export function isCoordinationStatus(v: unknown): v is CoordinationStatus {
  return typeof v === "string" && (COORDINATION_STATUSES as readonly string[]).includes(v);
}
export function isWaitingOn(v: unknown): v is WaitingOn {
  return typeof v === "string" && (WAITING_ON_VALUES as readonly string[]).includes(v);
}
export function isCoordinationKind(v: unknown): v is CoordinationKind {
  return typeof v === "string" && (COORDINATION_KINDS as readonly string[]).includes(v);
}

const text = (raw: Raw, key: string): string => {
  const v = raw[key];
  return typeof v === "string" ? v.trim() : "";
};

/** A real calendar date in YYYY-MM-DD, or null. */
export function normalizeDueDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return value;
}

/**
 * Turns what a Host typed into a valid input, or says plainly what is wrong. The Host's choices
 * are taken exactly as given: an unchosen delegation state stays unchosen (null); nothing is
 * defaulted, guessed or filled in.
 */
export function parseCoordinationInput(raw: Raw): Parsed {
  const kindRaw = text(raw, "kind") || "item";
  if (!isCoordinationKind(kindRaw)) return { ok: false, error: "Choose either a thing to coordinate or a decision." };

  const title = text(raw, "title");
  if (title.length === 0) return { ok: false, error: "Give this a title." };
  if (title.length > LIMITS.title) return { ok: false, error: `The title can be up to ${LIMITS.title} characters.` };

  const optional = (key: string, max: number, label: string): { ok: true; v: string | null } | { ok: false; error: string } => {
    const v = text(raw, key);
    if (v.length === 0) return { ok: true, v: null };
    if (v.length > max) return { ok: false, error: `${label} can be up to ${max} characters.` };
    return { ok: true, v };
  };

  const category = optional("category", LIMITS.category, "The category");
  if (!category.ok) return category;
  const assignedName = optional("assigned_to_name", LIMITS.assignedName, "The person's name");
  if (!assignedName.ok) return assignedName;
  const assignedRole = optional("assigned_to_role", LIMITS.assignedRole, "The person's role");
  if (!assignedRole.ok) return assignedRole;
  const proName = optional("professional_name", LIMITS.professionalName, "The professional's name");
  if (!proName.ok) return proName;
  const proRole = optional("professional_role", LIMITS.professionalRole, "The professional's role");
  if (!proRole.ok) return proRole;
  const nextAction = optional("next_action", LIMITS.nextAction, "The next action");
  if (!nextAction.ok) return nextAction;
  const roomLabel = optional("related_room_label", LIMITS.roomLabel, "The Room label");
  if (!roomLabel.ok) return roomLabel;

  const delegationRaw = text(raw, "delegation_state");
  let delegation: DelegationState | null = null;
  if (delegationRaw.length > 0) {
    if (!isDelegationState(delegationRaw)) return { ok: false, error: "That ownership choice is not one of the options." };
    delegation = delegationRaw;
  }

  const statusRaw = text(raw, "status") || "open";
  if (!isCoordinationStatus(statusRaw)) return { ok: false, error: "Status must be Open, Waiting or Closed." };

  let waitingOn: WaitingOn | null = null;
  let waitingNote: string | null = null;
  if (statusRaw === "waiting") {
    const w = text(raw, "waiting_on");
    if (!isWaitingOn(w)) return { ok: false, error: "Say who this is waiting on." };
    waitingOn = w;
    const note = optional("waiting_on_note", LIMITS.waitingNote, "The note");
    if (!note.ok) return note;
    waitingNote = note.v;
  }

  const dueRaw = text(raw, "due_date");
  let due: string | null = null;
  if (dueRaw.length > 0) {
    due = normalizeDueDate(dueRaw);
    if (!due) return { ok: false, error: "Enter the date as a real calendar date." };
  }

  const decisionRaw = text(raw, "related_decision_id");
  let relatedDecision: string | null = null;
  if (decisionRaw.length > 0) {
    if (!isUuid(decisionRaw)) return { ok: false, error: "That related decision could not be found." };
    relatedDecision = decisionRaw;
  }

  return {
    ok: true,
    value: {
      kind: kindRaw,
      title,
      category: category.v,
      delegation_state: delegation,
      assigned_to_name: assignedName.v,
      assigned_to_role: assignedRole.v,
      professional_name: proName.v,
      professional_role: proRole.v,
      status: statusRaw,
      waiting_on: waitingOn,
      waiting_on_note: waitingNote,
      next_action: nextAction.v,
      due_date: due,
      related_decision_id: relatedDecision,
      related_room_label: roomLabel.v,
    },
  };
}

/** Today as YYYY-MM-DD in UTC. A due date is a calendar day, not a moment. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A due date that has passed on an item that is still open or waiting. */
export function isOverdue(item: Pick<CoordinationItem, "status" | "due_date">, today: string): boolean {
  return item.status !== "closed" && !!item.due_date && item.due_date < today;
}

export type CoordinationSummary = { open: number; waiting: number; closed: number; overdue: number };

export function summarizeItems(items: Pick<CoordinationItem, "status" | "due_date">[], today: string): CoordinationSummary {
  const s: CoordinationSummary = { open: 0, waiting: 0, closed: 0, overdue: 0 };
  for (const i of items) {
    s[i.status] += 1;
    if (isOverdue(i, today)) s.overdue += 1;
  }
  return s;
}

/** Items in a stable display order within one status: due soonest first (undated last), then newest. */
export function sortForDisplay<T extends Pick<CoordinationItem, "due_date" | "created_at">>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

/** The only referral fields "Add to Coordination" can start from: the Host's own decisions and
 *  commitments, which are Host-voiced fields the existing Keep this rules already recognize.
 *  `nextStep` is deliberately not offered: it is a stage's own synthesis, not the Host's words,
 *  and those are never carried into the Host's record on a system's say-so (Decision 0006). */
export const COORDINATE_FROM_FIELDS = ["decisionsMade", "commitmentsChosen"] as const;
export type CoordinateFromField = (typeof COORDINATE_FROM_FIELDS)[number];
export function isCoordinateFromField(v: unknown): v is CoordinateFromField {
  return typeof v === "string" && (COORDINATE_FROM_FIELDS as readonly string[]).includes(v);
}
/** The kind an item starts as when it begins from one of those fields. The Host can change it. */
export function defaultKindForField(field: CoordinateFromField): CoordinationKind {
  return field === "decisionsMade" ? "decision" : "item";
}

/** The label a seeded item carries so the Host can see where it began. */
export const COORDINATE_FROM_LABEL: Record<CoordinateFromField, string> = {
  decisionsMade: "A decision you made",
  commitmentsChosen: "A commitment you chose",
};
