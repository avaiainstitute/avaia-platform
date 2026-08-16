import "server-only";
import { VIRTUE_FAMILIES, isValidVirtueFamily, isValidVirtueElement } from "@/lib/virtues";

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
