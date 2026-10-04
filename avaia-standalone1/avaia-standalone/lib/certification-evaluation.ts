// HUMAN EVALUATION RECORDS for Guide certification, as pure rules.
//
// People evaluate; the system only adds up what a person recorded. Nothing here
// scores anyone, and AI never evaluates, scores or certifies. These are the keys
// and rating vocabularies for three admin-recorded instruments:
//
//   * the ten-item Boundary Gate (each item: met / not met),
//   * the Universal Practice Lab Evaluation, completed after each Practice Lab,
//   * the 11-row Observed Practicum rubric (each row: Not Yet / Developing / Meets).
//
// The evaluator-only wording (prompts, pass standards, retraining paths, what to
// watch for) lives in lib/certification-evaluator-reference.ts, which the
// Companion and every candidate-facing surface never import (a build-time check
// enforces it). This file carries only keys, labels and the adding-up rules.

export const GATE_ITEM_KEYS = [
  "ownership",
  "privacy",
  "scope",
  "consent",
  "safety",
  "non_diagnosis",
  "non_prescription",
  "capacity_boundaries",
  "guide_authority",
  "consultation_referral",
] as const;
export type GateItemKey = (typeof GATE_ITEM_KEYS)[number];
export type GateItemResult = "met" | "not_met";

export const PRACTICUM_ROW_KEYS = [
  "iap",
  "cat",
  "innercompass",
  "stage_recognition",
  "difficult_host_patterns",
  "mistake_and_repair",
  "capacity_reading",
  "recognition_without_intervention",
  "boundary_holding",
  "ending_without_forced_resolution",
  "full_platform_workflow",
] as const;
export type PracticumRowKey = (typeof PRACTICUM_ROW_KEYS)[number];
export type PracticumRating = "not_yet" | "developing" | "meets";

export const PRACTICUM_RATING_LABEL: Record<PracticumRating, string> = {
  not_yet: "Not Yet",
  developing: "Developing",
  meets: "Meets",
};

/** Universal Practice Lab Evaluation, as written in the Lab Manual. */
export const LAB_FIRST_CRITERIA = ["host_ownership", "guide_seat", "listening", "outcome_control"] as const;
export const LAB_SECOND_CRITERIA = ["recognition_restraint", "capacity", "boundaries", "repair", "ending"] as const;
export type LabFirstCriterion = (typeof LAB_FIRST_CRITERIA)[number];
export type LabSecondCriterion = (typeof LAB_SECOND_CRITERIA)[number];
export type LabFirstRating = "demonstrated" | "developing" | "needs_targeted_practice";
export type LabSecondRating = "demonstrated" | "developing" | "not_observed";

export const LAB_CRITERION_LABEL: Record<LabFirstCriterion | LabSecondCriterion, string> = {
  host_ownership: "Host Ownership",
  guide_seat: "Guide Seat",
  listening: "Listening",
  outcome_control: "Outcome Control",
  recognition_restraint: "Recognition Restraint",
  capacity: "Capacity",
  boundaries: "Boundaries",
  repair: "Repair",
  ending: "Ending",
};
export const LAB_FIRST_RATING_LABEL: Record<LabFirstRating, string> = {
  demonstrated: "Demonstrated",
  developing: "Developing",
  needs_targeted_practice: "Needs Targeted Practice",
};
export const LAB_SECOND_RATING_LABEL: Record<LabSecondRating, string> = {
  demonstrated: "Demonstrated",
  developing: "Developing",
  not_observed: "Not Observed",
};

/** Candidate Feedback Response: Receive -> Understand -> Adjust -> Try Again. */
export const FEEDBACK_KEYS = ["receive", "understand", "adjust", "try_again"] as const;
export type FeedbackKey = (typeof FEEDBACK_KEYS)[number];
export const FEEDBACK_LABEL: Record<FeedbackKey, string> = { receive: "Receive", understand: "Understand", adjust: "Adjust", try_again: "Try Again" };

// ---------------------------------------------------------------------------
// Adding up what a person recorded
// ---------------------------------------------------------------------------

/** The Gate is complete only when every item has an answer, and passed only when
 *  every item is met (a candidate must meet standard on every item). Safety is
 *  never waived or partially scored: item 5 is simply one of the ten. */
export function tallyGate(items: Partial<Record<GateItemKey, GateItemResult>>): { complete: boolean; allMet: boolean; notMet: GateItemKey[] } {
  const complete = GATE_ITEM_KEYS.every((k) => items[k] === "met" || items[k] === "not_met");
  const notMet = GATE_ITEM_KEYS.filter((k) => items[k] === "not_met");
  return { complete, allMet: complete && notMet.length === 0, notMet };
}

/** The Practicum shows 'Meets' across every row, or it does not. */
export function tallyPracticum(rows: Partial<Record<PracticumRowKey, PracticumRating>>): { complete: boolean; allMeets: boolean; short: PracticumRowKey[] } {
  const complete = PRACTICUM_ROW_KEYS.every((k) => rows[k] === "not_yet" || rows[k] === "developing" || rows[k] === "meets");
  const short = PRACTICUM_ROW_KEYS.filter((k) => rows[k] !== "meets");
  return { complete, allMeets: complete && short.length === 0, short };
}

/** Practice Lab completion (Lab Manual): feedback received, required targeted
 *  retries done, and the candidate showed Receive -> Understand -> Adjust ->
 *  Try Again. A lab may be marked complete only when all four feedback steps
 *  are shown and no targeted retry is still required. The marking itself is the
 *  evaluator's; this only refuses a marking that contradicts the manual. */
export function labMayBeComplete(feedback: Partial<Record<FeedbackKey, boolean>>, targetedRetryRequired: boolean): boolean {
  return FEEDBACK_KEYS.every((k) => feedback[k] === true) && !targetedRetryRequired;
}

/** Practice Lab stage progress: complete when all 15 labs have an evaluation
 *  (the latest per lab) the evaluator marked complete. */
export function practiceProgress(latestByLab: Map<string, { lab_complete: boolean }>, labKeys: string[]): { completed: number; total: number; allComplete: boolean; remaining: string[] } {
  const remaining = labKeys.filter((k) => latestByLab.get(k)?.lab_complete !== true);
  return { completed: labKeys.length - remaining.length, total: labKeys.length, allComplete: labKeys.length > 0 && remaining.length === 0, remaining };
}
