import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VIRTUE_FAMILIES, isValidVirtueFamily, isValidVirtueElement } from "@/lib/virtues";
import { isValidSecondaryLoss } from "@/lib/institution";
import type { Stage } from "@/lib/engine/prompts";

// One authoritative mapping of referral field -> epistemic/provenance role,
// per stage. Built once so completion rendering, Workbook rendering, and
// future host_continuity_entries extraction all classify the same field the
// same way -- instead of each independently deciding what counts as
// Host-authored versus stage-authored, which is exactly how the "authored
// meaning becoming durable fact" and "provenance flattened" findings
// happened: the categorization only ever lived inline inside one renderer.

export type ProvenanceRole =
  | "host_authored" // verbatim or near-verbatim Host language
  | "stage_synthesis" // that stage's own organizing/interpretive work
  | "open_unresolved" // explicitly still-open material, not settled
  | "boundary_stewardship" // fenced-topic instructions, minimal by design
  | "decision_commitment"; // Host-voiced decisions/commitments specifically

export type FieldMeta = {
  role: ProvenanceRole;
  /** Human-readable label reused by every renderer -- completion prose,
   *  Workbook, future retrieval -- so labeling never drifts between them. */
  label: string;
};

export const IAP_FIELD_PROVENANCE: Record<string, FieldMeta> = {
  hostOverview: { role: "stage_synthesis", label: "Overview" },
  title: { role: "stage_synthesis", label: "Room Identity" },
  currentConcern: { role: "stage_synthesis", label: "Current concern IAP noticed" },
  primaryThreads: { role: "stage_synthesis", label: "Threads IAP noticed" },
  significantRelationships: { role: "stage_synthesis", label: "Relationships IAP noticed" },
  internalTensions: { role: "stage_synthesis", label: "Tensions IAP noticed" },
  strengthsAndSupports: { role: "stage_synthesis", label: "Strengths and supports IAP noticed" },
  listeningCues: { role: "stage_synthesis", label: "What IAP flagged worth listening for" },
  areasForExploration: { role: "open_unresolved", label: "Areas IAP left for exploration" },
  hostPriorities: { role: "stage_synthesis", label: "Priorities IAP noticed" },
  desiredDirection: { role: "stage_synthesis", label: "Direction IAP noticed" },
  secondaryLossesIdentified: { role: "stage_synthesis", label: "Secondary losses IAP identified" },
  governingNarratives: { role: "stage_synthesis", label: "Governing narratives IAP noticed" },
  anchorStatements: { role: "host_authored", label: "In the Host's own words" },
  reflectionsThatEmerged: { role: "host_authored", label: "In the Host's own words" },
  questionsWorthCarrying: { role: "open_unresolved", label: "Still open" },
  nextConversationPurpose: { role: "stage_synthesis", label: "Why IAP referred the Host here" },
  boundariesToProtect: { role: "boundary_stewardship", label: "Boundaries to protect" },
};

export const CAT_FIELD_PROVENANCE: Record<string, FieldMeta> = {
  hostOverview: { role: "stage_synthesis", label: "Overview" },
  title: { role: "stage_synthesis", label: "Room Identity" },
  majorUnderstandings: {
    role: "stage_synthesis",
    label: "Understandings and recognitions CAT carried forward",
  },
  primaryLoss: { role: "stage_synthesis", label: "Loss CAT identified as central" },
  significantSecondaryLosses: { role: "stage_synthesis", label: "Other losses CAT noticed" },
  keyRecognitions: {
    role: "stage_synthesis",
    label: "Understandings and recognitions CAT carried forward",
  },
  identityThreads: { role: "stage_synthesis", label: "Patterns CAT noticed" },
  activeTensions: { role: "stage_synthesis", label: "Tensions CAT noticed" },
  relevantVirtues: { role: "stage_synthesis", label: "Virtues CAT connected to this" },
  restorationTargets: { role: "stage_synthesis", label: "Restoration CAT flagged" },
  councilPerspectives: { role: "stage_synthesis", label: "Council perspectives CAT noted" },
  unresolvedQuestions: { role: "open_unresolved", label: "Still open" },
  integrationPoints: { role: "stage_synthesis", label: "Places CAT saw things connecting" },
  anchorStatements: { role: "host_authored", label: "In the Host's own words" },
  reflectionsThatEmerged: { role: "host_authored", label: "In the Host's own words" },
  questionsWorthCarrying: { role: "open_unresolved", label: "Still open" },
  nextConversationPurpose: { role: "stage_synthesis", label: "Why CAT referred the Host here" },
  boundariesToProtect: { role: "boundary_stewardship", label: "Boundaries to protect" },
};

export const INNERCOMPASS_FIELD_PROVENANCE: Record<string, FieldMeta> = {
  roomIdentity: { role: "stage_synthesis", label: "Room Identity" },
  centralDecisionOrDirection: { role: "decision_commitment", label: "Decision or direction" },
  rationale: { role: "stage_synthesis", label: "Reasoning InnerCompass offered" },
  virtuesInvolved: { role: "stage_synthesis", label: "Virtues InnerCompass connected to this" },
  obstacles: { role: "stage_synthesis", label: "Obstacles InnerCompass noticed" },
  capacityConsiderations: { role: "stage_synthesis", label: "Capacity InnerCompass noted" },
  nextStep: { role: "decision_commitment", label: "Next step" },
  followUpQuestions: { role: "open_unresolved", label: "Still open" },
  anchorStatements: { role: "host_authored", label: "In the Host's own words" },
  reflectionsThatEmerged: { role: "host_authored", label: "In the Host's own words" },
  questionsWorthCarrying: { role: "open_unresolved", label: "Still open" },
  decisionsMade: { role: "decision_commitment", label: "Decisions the Host made" },
  commitmentsChosen: { role: "decision_commitment", label: "Commitments the Host chose" },
  whatToPreserve: { role: "stage_synthesis", label: "What InnerCompass flagged to preserve" },
  boundariesToProtect: { role: "boundary_stewardship", label: "Boundaries to protect" },
  outcomeType: { role: "stage_synthesis", label: "Outcome" },
};

/** The canonical, internal shape every virtue-classification consumer reads
 *  -- element is always present as a key, either a real element name or
 *  null, never merely omitted. Everything that stores or renders a virtue
 *  classification (Workbook, sharing, CAT -> InnerCompass presentation,
 *  future continuity extraction) should go through normalizeVirtueClassifications
 *  rather than reading referral.content directly, so a legacy record and a
 *  current one are indistinguishable once normalized. */
export type VirtueClassification = { family: string; element: string | null };

/** Accepts either shape a stored relevantVirtues/virtuesInvolved value can
 *  currently be in and produces the canonical structured representation:
 *  - Legacy (historical CAT referrals, pre this round): a flat array of
 *    family-name strings, e.g. ["Integrity", "Positive Attitude"].
 *  - Current: an array of {family, element} objects, element nullable.
 *  This does not rewrite stored data -- referrals already in the database
 *  keep whichever shape they were written in; only reading normalizes.
 *  Anything that doesn't validate against the canonical Chemistry of Virtue
 *  hierarchy is silently dropped either way, matching the existing
 *  generation-time backstop in api/referral/route.ts. */
export function normalizeVirtueClassifications(value: unknown): VirtueClassification[] {
  if (!Array.isArray(value)) return [];
  const out: VirtueClassification[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      // Legacy shape: a flat family-name string. Case-insensitive match,
      // same tolerance the pre-this-round sanitizer applied, normalized to
      // the family's canonical display casing.
      const match = VIRTUE_FAMILIES.find(
        (f) => f.name.toLowerCase() === item.trim().toLowerCase()
      );
      if (match) out.push({ family: match.name, element: null });
      continue;
    }
    if (item && typeof item === "object") {
      const family = (item as { family?: unknown }).family;
      const element = (item as { element?: unknown }).element;
      if (typeof family !== "string" || !isValidVirtueFamily(family)) continue;
      if (element === null || element === undefined) {
        out.push({ family, element: null });
      } else if (typeof element === "string" && isValidVirtueElement(family, element)) {
        out.push({ family, element });
      }
      // else: element present but invalid -- dropped, not guessed at.
    }
  }
  return out;
}

/** Renders a virtue classification array (either legacy flat-string or
 *  current {family, element} shape) as display strings -- "Positive
 *  Attitude — Serenity" when a real element is present, just "Integrity"
 *  when it's family-only. */
export function formatVirtueClassifications(value: unknown): string[] {
  return normalizeVirtueClassifications(value).map((v) =>
    v.element ? `${v.family} — ${v.element}` : v.family
  );
}

/** Renders a secondary-loss array as display strings. Two shapes coexist:
 *  - Legacy (every referral before this round): a flat array of free-prose
 *    descriptions ("loss of home") never validated against the canonical
 *    ten Secondary Losses. There is no way to retroactively categorize
 *    these, so they're shown exactly as stored -- not dropped, not
 *    reclassified.
 *  - Current: an array of {category, description} objects, category
 *    validated against the canonical list, description an optional
 *    Host-specific elaboration alongside it. Renders as
 *    "Dreams / Opportunities — wanting to travel again" when a
 *    description is present, just the category when it isn't. An invalid
 *    category is dropped, not guessed at -- the same backstop treatment
 *    already proven for virtue classifications. */
export function formatSecondaryLossClassifications(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push(s);
      continue;
    }
    if (item && typeof item === "object") {
      const category = (item as { category?: unknown }).category;
      const description = (item as { description?: unknown }).description;
      if (typeof category !== "string" || !isValidSecondaryLoss(category)) continue;
      if (typeof description === "string" && description.trim()) {
        out.push(`${category} — ${description.trim()}`);
      } else {
        out.push(category);
      }
    }
  }
  return out;
}

const FIELD_PROVENANCE_FOR: Record<Stage, Record<string, FieldMeta>> = {
  iap: IAP_FIELD_PROVENANCE,
  cat: CAT_FIELD_PROVENANCE,
  innercompass: INNERCOMPASS_FIELD_PROVENANCE,
};

// Exported so a renderer (Workbook) can identify which formatReferralFields
// items are virtue fields and re-derive their structured {family, element}
// classifications via normalizeVirtueClassifications(rawContent[key]) --
// formatReferralFields itself only returns already-stringified display
// text, which isn't enough to build a link back to the specific Chemistry
// of Virtue entry.
export const VIRTUE_FIELD_KEYS = new Set(["relevantVirtues", "virtuesInvolved"]);
const SECONDARY_LOSS_FIELD_KEYS = new Set(["secondaryLossesIdentified", "significantSecondaryLosses"]);

const OUTCOME_TYPE_LABEL: Record<string, string> = {
  decision_made: "A decision was made",
  direction_chosen: "A direction was chosen",
  possibilities_identified: "Possibilities were identified",
  next_step_only: "A next step was identified",
  still_discerning: "Still discerning — no decision reached yet",
};

export type ReferralDisplayItem = {
  key: string;
  label: string;
  role: ProvenanceRole;
  value: string | string[];
};

/** The one deterministic, render-not-generate formatter for a stored
 *  referral's content -- turns the structured record into an ordered list
 *  of display-ready {label, role, value} items, driven entirely by the
 *  field -> provenance map above rather than each renderer re-deciding
 *  labels and shapes independently. Reused by Workbook and the
 *  Shared-with-me view today; the intended foundation for a future live
 *  completion display and host_continuity_entries extraction, so none of
 *  those diverge in how a field is labeled or a virtue is displayed.
 *
 *  Two or more fields sharing the same label (anchorStatements +
 *  reflectionsThatEmerged under "In the Host's own words"; CAT's
 *  majorUnderstandings + keyRecognitions; unresolvedQuestions /
 *  followUpQuestions + questionsWorthCarrying under "Still open," ...)
 *  merge into one display item, exact-string deduplicated in first-seen
 *  order -- the same approach already proven in
 *  formatCatReferralForInnerCompass, generalized here so it's driven by
 *  the field metadata itself rather than a hardcoded field-name list, and
 *  applies uniformly wherever it occurs across IAP, CAT, and InnerCompass
 *  instead of needing a separate fix per stage. Without this, two fields
 *  with the same label rendered as two adjacent sections with an
 *  identical, duplicated heading.
 *
 *  `stage` is the referral's `from_stage` -- the schema that produced
 *  `content` -- not the stage it was referred to. Fields absent, empty, or
 *  blank are omitted rather than shown empty. */
export function formatReferralFields(
  stage: Stage,
  content: Record<string, unknown> | null | undefined
): ReferralDisplayItem[] {
  if (!content) return [];
  const map = FIELD_PROVENANCE_FOR[stage];
  if (!map) return [];
  const out: ReferralDisplayItem[] = [];
  const arrayItemIndexByLabel = new Map<string, number>();

  const pushArray = (key: string, meta: FieldMeta, items: string[]) => {
    if (items.length === 0) return;
    const existingIndex = arrayItemIndexByLabel.get(meta.label);
    if (existingIndex !== undefined) {
      const existing = out[existingIndex].value as string[];
      const seen = new Set(existing);
      for (const v of items) {
        if (!seen.has(v)) {
          existing.push(v);
          seen.add(v);
        }
      }
      return;
    }
    arrayItemIndexByLabel.set(meta.label, out.length);
    out.push({ key, label: meta.label, role: meta.role, value: [...items] });
  };

  for (const [key, meta] of Object.entries(map)) {
    const raw = content[key];
    if (VIRTUE_FIELD_KEYS.has(key)) {
      pushArray(key, meta, formatVirtueClassifications(raw));
      continue;
    }
    if (SECONDARY_LOSS_FIELD_KEYS.has(key)) {
      pushArray(key, meta, formatSecondaryLossClassifications(raw));
      continue;
    }
    if (key === "outcomeType") {
      // Scalar, one-off label ("Outcome") -- never collides with another
      // field, so no merge handling needed.
      if (typeof raw === "string" && raw in OUTCOME_TYPE_LABEL) {
        out.push({ key, label: meta.label, role: meta.role, value: OUTCOME_TYPE_LABEL[raw] });
      }
      continue;
    }
    if (Array.isArray(raw)) {
      const items = raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      pushArray(key, meta, items);
      continue;
    }
    if (typeof raw === "string" && raw.trim().length > 0) {
      // No scalar (str) field currently shares a label with another field;
      // no merge handling needed here either.
      out.push({ key, label: meta.label, role: meta.role, value: raw.trim() });
    }
  }
  return out;
}

export type CompletionSummary = {
  roomIdentity?: string;
  outcomeLabel?: string;
  direction?: string;
  /** A short, already-generated field describing what the *next*
   *  conversation is about -- used for the incoming-referral hand-off
   *  screen (JourneyIntro), not the completion card. Sourced per stage
   *  below; absent for stages nothing follows. */
  description?: string;
  /** Virtue Signature connection fix: the same structured classifications
   *  already stored in this referral (CAT's relevantVirtues, InnerCompass's
   *  virtuesInvolved -- IAP produces neither, VIRTUE_TABLE_INTEGRATION
   *  isn't composed into IAP), surfaced on the completion card so "What
   *  Became Visible" (components/WhatBecameVisible.tsx) can offer each one
   *  for exploring in Chemistry or considering for the Host's own Virtue
   *  Signature. Not a new generation -- the exact data Workbook already
   *  renders, just reaching the Host at the moment it's freshest. */
  virtues?: VirtueClassification[];
};

// A short established-direction field exists for some stages, not others --
// IAP's desiredDirection, InnerCompass's centralDecisionOrDirection. CAT
// has no equivalent (CAT produces understanding, not a decision), so it's
// simply absent here rather than guessed at.
const DIRECTION_FIELD_FOR: Partial<Record<Stage, string>> = {
  iap: "desiredDirection",
  innercompass: "centralDecisionOrDirection",
};

// Which already-generated field best describes the conversation a Host is
// about to enter, keyed by the stage that PRODUCED the referral (not the
// stage it's headed to) -- IAP's currentConcern for the CAT hand-off,
// CAT's own nextConversationPurpose (literally written for this) for the
// InnerCompass hand-off. No equivalent for innercompass -- nothing follows
// it in the three-stage Journey.
const DESCRIPTION_FIELD_FOR: Partial<Record<Stage, string>> = {
  iap: "currentConcern",
  cat: "nextConversationPurpose",
};

/** A handful of fields selected from the already-generated, already-stored
 *  referral -- for the compact live-conversation completion card only, not
 *  a second generation and not a new summary. Room Identity is found the
 *  same way for every stage (whichever field is labeled "Room Identity" in
 *  that stage's own provenance map, so IAP/CAT's `title` and InnerCompass's
 *  `roomIdentity` both resolve the same way); outcome uses the exact same
 *  OUTCOME_TYPE_LABEL formatReferralFields already uses. The full referral
 *  remains readable only in Workbook's Guide's Record, via
 *  formatReferralFields, completely unchanged by this. */
export function getCompletionSummary(
  stage: Stage,
  content: Record<string, unknown> | null | undefined
): CompletionSummary {
  const summary: CompletionSummary = {};
  if (!content) return summary;
  const map = FIELD_PROVENANCE_FOR[stage];

  const roomIdentityKey = map && Object.keys(map).find((k) => map[k].label === "Room Identity");
  if (roomIdentityKey) {
    const v = content[roomIdentityKey];
    if (typeof v === "string" && v.trim()) summary.roomIdentity = v.trim();
  }

  if (stage === "innercompass") {
    const outcome = content.outcomeType;
    if (typeof outcome === "string" && outcome in OUTCOME_TYPE_LABEL) {
      summary.outcomeLabel = OUTCOME_TYPE_LABEL[outcome];
    }
  }

  const directionKey = DIRECTION_FIELD_FOR[stage];
  if (directionKey) {
    const v = content[directionKey];
    if (typeof v === "string" && v.trim()) summary.direction = v.trim();
  }

  const descriptionKey = DESCRIPTION_FIELD_FOR[stage];
  if (descriptionKey) {
    const v = content[descriptionKey];
    if (typeof v === "string" && v.trim()) summary.description = v.trim();
  }

  const virtueKey = map && Object.keys(map).find((k) => VIRTUE_FIELD_KEYS.has(k));
  if (virtueKey) {
    const classifications = normalizeVirtueClassifications(content[virtueKey]);
    if (classifications.length > 0) summary.virtues = classifications;
  }

  return summary;
}

/** The Room Identity + short description a Host should see on the
 *  hand-off screen entering `forStage` -- e.g. entering "cat" reads the
 *  most recent referral addressed to CAT (produced by IAP) and reuses
 *  getCompletionSummary's own field extraction for it, exactly as the
 *  completion card already does for the stage that just finished. Same
 *  already-stored data, different moment it's shown. Returns null when
 *  there's no incoming referral yet (e.g. entering IAP, which has none).
 */
export async function getIncomingSummary(
  supabase: SupabaseClient,
  hostId: string,
  forStage: Stage
): Promise<CompletionSummary | null> {
  const { data } = await supabase
    .from("referrals")
    .select("content, from_stage")
    .eq("host_id", hostId)
    .eq("to_stage", forStage)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const content = data.content as Record<string, unknown> | null;
  return getCompletionSummary(data.from_stage as Stage, content);
}
