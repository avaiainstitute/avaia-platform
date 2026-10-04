import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPracticeLabs } from "@/lib/certification-content";
import { boundaryGateEligibility, latestByType, type EvidenceRow, type EvidenceType } from "@/lib/certification-operations";
import {
  FEEDBACK_KEYS,
  LAB_FIRST_CRITERIA,
  LAB_SECOND_CRITERIA,
  labMayBeComplete,
  practiceProgress,
  tallyGate,
  tallyPracticum,
  type FeedbackKey,
  type GateItemKey,
  type GateItemResult,
  type LabFirstCriterion,
  type LabFirstRating,
  type LabSecondCriterion,
  type LabSecondRating,
  type PracticumRating,
  type PracticumRowKey,
} from "@/lib/certification-evaluation";

// HUMAN EVALUATION RECORDS (the I/O side). A person evaluates; these functions
// only store what the person recorded and add it up. They are called only from
// the admin candidate page, after its own admin check. Nothing here scores,
// ranks or judges a candidate, and the AI never calls any of it.
//
// Each recording also writes the matching evidence row (boundary_gate,
// practice_facilitation, observed_practicum) so the existing certification
// pipeline and the human certification decision read one record. The
// certification decision itself is never made here.

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

async function latestEvidence(candidateId: string): Promise<Partial<Record<EvidenceType, EvidenceRow>>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("guide_candidate_evidence")
    .select("evidence_type, rating, recorded_by, recorded_at")
    .eq("candidate_id", candidateId);
  return latestByType((data ?? []) as EvidenceRow[]);
}

async function candidateIsOpen(candidateId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("guide_candidates").select("status").eq("id", candidateId).maybeSingle();
  const status = (data as { status?: string } | null)?.status;
  return !!status && status !== "withdrawn" && status !== "not_certified";
}

async function writeEvidence(candidateId: string, type: EvidenceType, rating: "competent" | "development_required", summary: string, recordedBy: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("guide_candidate_evidence").insert({ candidate_id: candidateId, evidence_type: type, rating, summary, recorded_by: recordedBy });
  return !error;
}

// ---------------------------------------------------------------------------
// Boundary Gate
// ---------------------------------------------------------------------------

export async function recordGateEvaluation(args: {
  candidateId: string;
  evaluatorId: string;
  items: Partial<Record<GateItemKey, GateItemResult>>;
  notes: string;
}): Promise<Result<{ allMet: boolean; notMet: GateItemKey[] }>> {
  if (!(await candidateIsOpen(args.candidateId))) return { ok: false, error: "This candidacy is closed." };
  const tally = tallyGate(args.items);
  if (!tally.complete) return { ok: false, error: "Mark every one of the ten Gate items met or not met." };

  const latest = await latestEvidence(args.candidateId);
  const eligibility = boundaryGateEligibility({ ...latest, boundary_gate: undefined });
  if (eligibility.missing.length > 0) {
    return { ok: false, error: `The Gate comes after the classroom stage and the candidate's own Host-seat experience. Still outstanding: ${eligibility.missing.join(", ")}.` };
  }
  if (latest.boundary_gate?.rating === "competent") return { ok: false, error: "The Boundary Gate is already recorded as met." };

  const admin = createAdminClient();
  const { error } = await admin.from("certification_gate_evaluations").insert({
    candidate_id: args.candidateId,
    evaluator_id: args.evaluatorId,
    items: args.items,
    all_met: tally.allMet,
    notes: args.notes || null,
  });
  if (error) return { ok: false, error: "Could not record the Gate evaluation." };

  const safetyNotMet = tally.notMet.includes("safety");
  const summary = tally.allMet
    ? "Boundary Gate: all ten items met."
    : `Boundary Gate: not met on ${tally.notMet.join(", ")}.${safetyNotMet ? " Safety not met: mandatory retraining on Lesson 6.9 before reassessment (never waived or partial)." : ""}`;
  const wrote = await writeEvidence(args.candidateId, "boundary_gate", tally.allMet ? "competent" : "development_required", summary, args.evaluatorId);
  if (!wrote) return { ok: false, error: "The Gate evaluation was saved but its evidence row could not be written. Please record the Boundary Gate evidence by hand." };
  return { ok: true, allMet: tally.allMet, notMet: tally.notMet };
}

// ---------------------------------------------------------------------------
// Practice Labs
// ---------------------------------------------------------------------------

export type LabRatingsInput = {
  first: Partial<Record<LabFirstCriterion, { rating: LabFirstRating; evidence: string }>>;
  second: Partial<Record<LabSecondCriterion, LabSecondRating>>;
};

export async function recordLabEvaluation(args: {
  candidateId: string;
  labKey: string;
  evaluatorId: string;
  ratings: LabRatingsInput;
  feedback: Partial<Record<FeedbackKey, boolean>>;
  targetedRetryRequired: boolean;
  labComplete: boolean;
  notes: string;
}): Promise<Result<{ completed: number; total: number; allComplete: boolean }>> {
  if (!(await candidateIsOpen(args.candidateId))) return { ok: false, error: "This candidacy is closed." };
  const labs = getPracticeLabs();
  if (!labs.some((l) => l.item_key === args.labKey)) return { ok: false, error: "That is not one of the fifteen Practice Labs." };
  for (const k of LAB_FIRST_CRITERIA) if (!args.ratings.first[k]?.rating) return { ok: false, error: "Rate Host Ownership, Guide Seat, Listening and Outcome Control." };
  for (const k of LAB_SECOND_CRITERIA) if (!args.ratings.second[k]) return { ok: false, error: "Rate Recognition Restraint, Capacity, Boundaries, Repair and Ending (use Not Observed where it did not come up)." };
  if (args.labComplete && !labMayBeComplete(args.feedback, args.targetedRetryRequired)) {
    return { ok: false, error: "A lab can be marked complete only when the candidate showed Receive, Understand, Adjust and Try Again, and no targeted retry is still required." };
  }

  const latest = await latestEvidence(args.candidateId);
  if (latest.boundary_gate?.rating !== "competent") {
    return { ok: false, error: "Practice Labs begin once the Boundary Gate is recorded as met." };
  }

  const admin = createAdminClient();
  const feedback: Record<string, boolean> = {};
  for (const k of FEEDBACK_KEYS) feedback[k] = args.feedback[k] === true;
  const { error } = await admin.from("certification_lab_evaluations").insert({
    candidate_id: args.candidateId,
    lab_key: args.labKey,
    evaluator_id: args.evaluatorId,
    ratings: args.ratings,
    feedback_response: feedback,
    targeted_retry_required: args.targetedRetryRequired,
    lab_complete: args.labComplete,
    notes: args.notes || null,
  });
  if (error) return { ok: false, error: "Could not record the lab evaluation." };

  const progress = await getPracticeStatus(args.candidateId);
  if (progress.allComplete && latest.practice_facilitation?.rating !== "competent") {
    const wrote = await writeEvidence(
      args.candidateId,
      "practice_facilitation",
      "competent",
      `Practice Lab stage complete: all ${progress.total} labs marked complete by the evaluator, with feedback received and required targeted retries done.`,
      args.evaluatorId
    );
    if (!wrote) return { ok: false, error: "The lab evaluation was saved but the Practice Lab completion evidence could not be written. Please record it by hand." };
  }
  return { ok: true, completed: progress.completed, total: progress.total, allComplete: progress.allComplete };
}

export type PracticeStatus = {
  completed: number;
  total: number;
  allComplete: boolean;
  remaining: string[];
  latestByLab: Map<string, { lab_complete: boolean; targeted_retry_required: boolean; created_at: string }>;
};

/** Adds up the evaluator's marks: the latest evaluation per lab decides whether
 *  that lab is complete. */
export async function getPracticeStatus(candidateId: string): Promise<PracticeStatus> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("certification_lab_evaluations")
    .select("lab_key, lab_complete, targeted_retry_required, created_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: true });
  const latestByLab = new Map<string, { lab_complete: boolean; targeted_retry_required: boolean; created_at: string }>();
  for (const r of (data ?? []) as { lab_key: string; lab_complete: boolean; targeted_retry_required: boolean; created_at: string }[]) {
    latestByLab.set(r.lab_key, { lab_complete: r.lab_complete, targeted_retry_required: r.targeted_retry_required, created_at: r.created_at });
  }
  const progress = practiceProgress(latestByLab, getPracticeLabs().map((l) => l.item_key));
  return { ...progress, latestByLab };
}

// ---------------------------------------------------------------------------
// Observed Practicum
// ---------------------------------------------------------------------------

export async function recordPracticumEvaluation(args: {
  candidateId: string;
  evaluatorId: string;
  rows: Partial<Record<PracticumRowKey, PracticumRating>>;
  notes: string;
}): Promise<Result<{ allMeets: boolean; short: PracticumRowKey[] }>> {
  if (!(await candidateIsOpen(args.candidateId))) return { ok: false, error: "This candidacy is closed." };
  const tally = tallyPracticum(args.rows);
  if (!tally.complete) return { ok: false, error: "Rate every one of the eleven Practicum rows." };

  const latest = await latestEvidence(args.candidateId);
  if (latest.boundary_gate?.rating !== "competent") return { ok: false, error: "The Practicum comes after the Boundary Gate is recorded as met." };
  if (latest.practice_facilitation?.rating !== "competent") return { ok: false, error: "The Practicum comes after Practice Lab completion: practice before independent Guide work." };
  if (latest.observed_practicum?.rating === "competent") return { ok: false, error: "The Observed Practicum is already recorded as met." };

  const admin = createAdminClient();
  const { error } = await admin.from("certification_practicum_evaluations").insert({
    candidate_id: args.candidateId,
    evaluator_id: args.evaluatorId,
    rows: args.rows,
    all_meets: tally.allMeets,
    notes: args.notes || null,
  });
  if (error) return { ok: false, error: "Could not record the Practicum evaluation." };

  const summary = tally.allMeets
    ? "Observed Practicum: Meets on all eleven rows."
    : `Observed Practicum: not yet Meets on ${tally.short.join(", ")}.`;
  const wrote = await writeEvidence(args.candidateId, "observed_practicum", tally.allMeets ? "competent" : "development_required", summary, args.evaluatorId);
  if (!wrote) return { ok: false, error: "The Practicum evaluation was saved but its evidence row could not be written. Please record it by hand." };
  return { ok: true, allMeets: tally.allMeets, short: tally.short };
}

// ---------------------------------------------------------------------------
// What the admin page shows
// ---------------------------------------------------------------------------

export type EvaluationSummary = {
  gate: { created_at: string; all_met: boolean; items: Record<string, string>; notes: string | null }[];
  practicum: { created_at: string; all_meets: boolean; rows: Record<string, string>; notes: string | null }[];
};

export async function getEvaluationSummary(candidateId: string): Promise<EvaluationSummary> {
  const admin = createAdminClient();
  const [{ data: gate }, { data: practicum }] = await Promise.all([
    admin.from("certification_gate_evaluations").select("created_at, all_met, items, notes").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
    admin.from("certification_practicum_evaluations").select("created_at, all_meets, rows, notes").eq("candidate_id", candidateId).order("created_at", { ascending: false }),
  ]);
  return {
    gate: (gate ?? []) as EvaluationSummary["gate"],
    practicum: (practicum ?? []) as EvaluationSummary["practicum"],
  };
}


// ---------------------------------------------------------------------------
// The candidate's own Host-seat experience (metadata only)
// ---------------------------------------------------------------------------

export type HostSeatMetadata = {
  journeysStarted: number;
  journeysCompleted: number;
  stages: { stage: string; status: string; startedAt: string }[];
};

/** What the evaluator may see about the candidate's own time in the Host seat:
 *  which Journey stages exist and which are complete, with dates. Metadata only.
 *  It never reads a message, a Guide's Record, a Workbook or any conversation
 *  content: whether this was a genuine Host-seat experience is the evaluator's
 *  judgment, recorded as evidence. */
export async function getHostSeatMetadata(hostId: string): Promise<HostSeatMetadata> {
  const admin = createAdminClient();
  const [{ data: journeys }, { data: conversations }] = await Promise.all([
    admin.from("journeys").select("id, started_at, completed_at").eq("host_id", hostId),
    admin.from("conversations").select("stage, status, created_at").eq("host_id", hostId).order("created_at", { ascending: true }),
  ]);
  const journeyRows = (journeys ?? []) as { id: string; started_at: string; completed_at: string | null }[];
  const stageRows = (conversations ?? []) as { stage: string; status: string; created_at: string }[];
  return {
    journeysStarted: journeyRows.length,
    journeysCompleted: journeyRows.filter((j) => j.completed_at).length,
    stages: stageRows
      .filter((c) => c.stage === "iap" || c.stage === "cat" || c.stage === "innercompass")
      .map((c) => ({ stage: c.stage, status: c.status, startedAt: c.created_at })),
  };
}

/** True once a person has recorded the Boundary Gate as met for this candidate.
 *  Read with the service role because candidates cannot read evidence rows. */
export async function boundaryGatePassed(candidateId: string): Promise<boolean> {
  const latest = await latestEvidence(candidateId);
  return latest.boundary_gate?.rating === "competent";
}
