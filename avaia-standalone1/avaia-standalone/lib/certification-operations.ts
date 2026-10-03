import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompletableLessons, getPracticeLabs } from "@/lib/certification-content";

/**
 * AVAIA Certification Operations Agent -- typed, deterministic workflow-state
 * module. Mirrors lib/certification.ts's and lib/ops/guide-operations.ts's own
 * governing rule: this module reads existing institutional records and
 * reports mechanical facts about them. It never evaluates competency, never
 * grades a Boundary Gate or Practicum, never decides Critical Fail, never
 * certifies anyone, and never invents a requirement that doesn't already
 * exist in guide_candidate_evidence's own evidence_type vocabulary
 * (supabase/migrations/0100_certification_schema_baseline.sql).
 *
 * guide_candidates.status remains the one authoritative lifecycle enum. The
 * "operational state" this module computes is a derived view layered on top
 * of it (plus guide_candidate_evidence, guide_certification_decisions,
 * guide_certifications, guide_platform_authorizations, profiles, and the
 * Companion's own certification_candidate_progress) -- never a second status
 * column, never written back to any table as a stored value.
 */

// ---------------------------------------------------------------------------
// Evidence vocabulary -- copied verbatim from the live evidence_type check
// constraint (0100), in the order the constraint itself lists them. This
// order is the only ordering this module relies on; it is not invented here.
// ---------------------------------------------------------------------------

export const EVIDENCE_TYPE_ORDER = [
  "candidate_agreement",
  "foundations_knowledge_check",
  "judgment_scenarios",
  "table_building_exercise",
  "recognition_assessment",
  "conversation_review",
  "practice_facilitation",
  "toolkit_experience_assembly",
  "boundary_gate",
  "observed_practicum",
  "guides_record_sample",
  "reflection_debrief",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPE_ORDER)[number];

/** Items 1-6 of the established order: everything administratively prior to
 *  Practice Facilitation itself. */
const PRE_PRACTICE_TYPES: EvidenceType[] = [
  "candidate_agreement",
  "foundations_knowledge_check",
  "judgment_scenarios",
  "table_building_exercise",
  "recognition_assessment",
  "conversation_review",
];

/** Items 1-8: everything administratively prior to Boundary Gate, i.e.
 *  PRE_PRACTICE_TYPES plus Practice Facilitation and Toolkit Experience
 *  Assembly (both already-established evidence types, not invented here). */
const PRE_GATE_TYPES: EvidenceType[] = [...PRE_PRACTICE_TYPES, "practice_facilitation", "toolkit_experience_assembly"];

const OPEN_CANDIDACY_STATUSES = ["admitted", "in_training", "development_required", "paused", "hold"];
const CLOSED_CANDIDACY_STATUSES = ["withdrawn", "not_certified"];

export type EvidenceRating = "competent" | "development_required" | "critical_fail";

export type EvidenceRow = {
  evidence_type: EvidenceType;
  rating: EvidenceRating;
  recorded_by: string | null;
  recorded_at: string;
};

export type CandidateRow = {
  id: string;
  host_id: string;
  status: string;
  admitted_at: string;
  ready_for_review: boolean;
  ready_for_review_notes: string | null;
};

export type DecisionRow = {
  decision: "certified" | "development_required" | "not_currently_eligible";
  decision_date: string;
};

export type CertificationRow = {
  standing: "active" | "paused" | "revoked" | "inactive";
  certified_at: string;
};

export type PlatformAuthStatus = "authorized" | "revoked" | null;

export type ProfileRow = {
  role: string | null;
  guide_certified_at: string | null;
};

export type ProgressSummary = {
  // Self-reported only (certification_candidate_progress) -- never evidence,
  // never a competency signal. Used only to describe where a candidate says
  // they are in the curriculum, the same "self-report only" framing
  // lib/certification.ts already uses for this table.
  lessonsSelfCheckedComplete: number;
  lessonsTotal: number;
  labsSelfCheckedComplete: number;
  labsTotal: number;
  lastSelfReportedAt: string | null;
};

export const OPERATIONAL_STATES = [
  "agreement_pending",
  "training_active",
  "practice_eligible",
  "boundary_gate_eligible",
  "boundary_gate_waiting",
  "practicum_eligible",
  "practicum_waiting",
  "portfolio_incomplete",
  "ready_for_human_review",
  "decision_recorded",
  "permission_activation_pending",
  "guide_handoff_complete",
] as const;

export type OperationalState = (typeof OPERATIONAL_STATES)[number] | "lifecycle_closed";

export const EXCEPTION_CATEGORIES = [
  "MISSING",
  "WAITING",
  "STALE",
  "MISMATCH",
  "FAILED",
  "HUMAN_DECISION_REQUIRED",
  "POLICY_REQUIRED",
] as const;

export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number];

/** A stable name for each root cause, so the same condition is never reported twice
 *  and every consumer (Needs-Dorian, the self-test) can classify it. */
export type ExceptionCode =
  | "critical_fail"
  | "gate_waiting"
  | "practicum_waiting"
  | "ready_for_review"
  | "mismatch_no_decision"
  | "missing_certification"
  | "activation_pending"
  | "stale";

export type CertificationException = { category: ExceptionCategory; code: ExceptionCode; detail: string };

export type CertificationOperationsRecord = {
  candidateId: string;
  hostId: string;
  lifecycleStatus: string;
  admittedAt: string;
  readyForReview: boolean;
  readyForReviewNotes: string | null;
  progress: ProgressSummary;
  latestEvidenceByType: Partial<Record<EvidenceType, EvidenceRow>>;
  decision: DecisionRow | null;
  certification: CertificationRow | null;
  /** Holds an active 'founder_test' entitlement: Dorian's designated test account. */
  designatedTestAccount: boolean;
  profileRole: string | null;
  guideCertifiedAt: string | null;
  toolkitAuthorizationStatus: PlatformAuthStatus;
  journeyFacilitationAuthorizationStatus: PlatformAuthStatus;
  derivedState: OperationalState;
  missingPrerequisites: EvidenceType[];
  nextAction: string;
  humanActionRequired: boolean;
  lastActivityAt: string | null;
  exceptions: CertificationException[];
};

function latestByType(rows: EvidenceRow[]): Partial<Record<EvidenceType, EvidenceRow>> {
  const out: Partial<Record<EvidenceType, EvidenceRow>> = {};
  for (const row of rows) {
    const existing = out[row.evidence_type];
    if (!existing || new Date(row.recorded_at) > new Date(existing.recorded_at)) {
      out[row.evidence_type] = row;
    }
  }
  return out;
}

function isCompetent(latest: Partial<Record<EvidenceType, EvidenceRow>>, type: EvidenceType): boolean {
  return latest[type]?.rating === "competent";
}

function missingFromList(latest: Partial<Record<EvidenceType, EvidenceRow>>, types: EvidenceType[]): EvidenceType[] {
  return types.filter((t) => !isCompetent(latest, t));
}

/** Boundary Gate ADMINISTRATIVE eligibility only -- whether the established
 *  pre-requisite evidence is on file and competent, and no Boundary Gate
 *  attempt is already recorded. This never judges the Gate itself; the
 *  Gate's own pass/fail is a human evaluator's recorded evidence row
 *  (evidence_type: 'boundary_gate'), read here, never computed here. */
export function boundaryGateEligibility(latest: Partial<Record<EvidenceType, EvidenceRow>>): {
  eligible: boolean;
  missing: EvidenceType[];
  alreadyAttempted: boolean;
} {
  const missing = missingFromList(latest, PRE_GATE_TYPES);
  const alreadyAttempted = !!latest.boundary_gate;
  return { eligible: missing.length === 0 && !alreadyAttempted, missing, alreadyAttempted };
}

/** Practicum ADMINISTRATIVE eligibility only -- requires a recorded Boundary
 *  Gate pass (the human evaluator's own evidence row, rating: 'competent')
 *  plus nothing else invented. No practicum count or additional requirement
 *  exists in the current certification records, so none is added here. */
export function practicumEligibility(latest: Partial<Record<EvidenceType, EvidenceRow>>): {
  eligible: boolean;
  boundaryGatePassed: boolean;
  alreadyAttempted: boolean;
} {
  const boundaryGatePassed = isCompetent(latest, "boundary_gate");
  const alreadyAttempted = !!latest.observed_practicum;
  return { eligible: boundaryGatePassed && !alreadyAttempted, boundaryGatePassed, alreadyAttempted };
}

/** Portfolio completeness -- presence of a competent record for every
 *  established evidence_type, nothing more. If this is true, the only thing
 *  this module will ever say is that the portfolio is administratively
 *  complete and ready for a human to review -- never that the candidate is
 *  ready to be certified, which is a human judgment this module cannot and
 *  does not make. */
export function portfolioCompleteness(latest: Partial<Record<EvidenceType, EvidenceRow>>): {
  complete: boolean;
  missing: EvidenceType[];
} {
  const missing = missingFromList(latest, [...EVIDENCE_TYPE_ORDER]);
  return { complete: missing.length === 0, missing };
}

function hasCriticalFail(latest: Partial<Record<EvidenceType, EvidenceRow>>): EvidenceType[] {
  return EVIDENCE_TYPE_ORDER.filter((t) => latest[t]?.rating === "critical_fail");
}

function describeMissing(types: EvidenceType[]): string {
  return types.join(", ");
}

/** The derived-state waterfall. Pure function, no I/O -- every input is
 *  already-read data from one existing table each. Order matters: later
 *  branches assume earlier ones didn't match, exactly the way a candidate
 *  actually moves through the established evidence vocabulary. */
export function deriveOperationalState(args: {
  lifecycleStatus: string;
  latest: Partial<Record<EvidenceType, EvidenceRow>>;
  decision: DecisionRow | null;
  certification: CertificationRow | null;
  toolkitAuthorizationStatus: PlatformAuthStatus;
}): {
  state: OperationalState;
  missingPrerequisites: EvidenceType[];
  nextAction: string;
  humanActionRequired: boolean;
} {
  const { lifecycleStatus, latest, decision, certification } = args;

  if (CLOSED_CANDIDACY_STATUSES.includes(lifecycleStatus)) {
    return {
      state: "lifecycle_closed",
      missingPrerequisites: [],
      nextAction: `Candidacy lifecycle status is "${lifecycleStatus}" -- no active operational workflow.`,
      humanActionRequired: false,
    };
  }

  // A human certification decision already exists -- hand off tracking
  // takes over from here regardless of how the portfolio/evidence looks.
  if (decision) {
    if (decision.decision === "certified") {
      const certificationExists = !!certification;
      const standingActive = certification?.standing === "active";
      // Reconciled to production: being a Guide is decided by an ACTIVE
      // guide_certifications row plus a Toolkit platform authorization
      // (guide_platform_authorizations), never by profiles.role (which
      // production no longer sets or reads for access).
      const toolkitAuthorized = args.toolkitAuthorizationStatus === "authorized";
      if (certificationExists && !standingActive) {
        // Standing after certification (paused, revoked, or inactive at the
        // end of a 365-day period) is governed by the certification renewal
        // lifecycle and human standing decisions, not by this workflow.
        return {
          state: "decision_recorded",
          missingPrerequisites: [],
          nextAction: `Certified; certification standing is "${certification?.standing}", managed by the certification renewal lifecycle and human standing decisions. No Operations Agent action.`,
          humanActionRequired: false,
        };
      }
      if (certificationExists && standingActive && toolkitAuthorized) {
        return {
          state: "guide_handoff_complete",
          missingPrerequisites: [],
          nextAction: "Certification and platform handoff complete.",
          humanActionRequired: false,
        };
      }
      const missingPieces: string[] = [];
      if (!certificationExists) missingPieces.push("guide_certifications record");
      if (!toolkitAuthorized) missingPieces.push("Toolkit platform authorization (a human admin grants it)");
      return {
        state: "permission_activation_pending",
        missingPrerequisites: [],
        nextAction: `Certified but handoff incomplete -- missing: ${missingPieces.join(", ")}.`,
        humanActionRequired: true,
      };
    }
    return {
      state: "decision_recorded",
      missingPrerequisites: [],
      nextAction: `Certification decision already recorded (${decision.decision}); no further Operations Agent action.`,
      humanActionRequired: false,
    };
  }

  const portfolio = portfolioCompleteness(latest);
  if (portfolio.complete) {
    return {
      state: "ready_for_human_review",
      missingPrerequisites: [],
      nextAction: "READY FOR HUMAN CERTIFICATION REVIEW -- portfolio is administratively complete; record a certification decision.",
      humanActionRequired: true,
    };
  }

  const practicum = practicumEligibility(latest);
  if (practicum.boundaryGatePassed) {
    if (practicum.alreadyAttempted) {
      const rating = latest.observed_practicum?.rating;
      return {
        state: "practicum_waiting",
        missingPrerequisites: [],
        nextAction: `Observed Practicum evidence recorded (${rating}), not yet competent -- human decision needed on retry or remediation.`,
        humanActionRequired: true,
      };
    }
    return {
      state: "practicum_eligible",
      missingPrerequisites: [],
      nextAction: "Candidate is administratively eligible for Observed Practicum; schedule when ready.",
      humanActionRequired: false,
    };
  }

  const gate = boundaryGateEligibility(latest);
  if (gate.alreadyAttempted) {
    const rating = latest.boundary_gate?.rating;
    return {
      state: "boundary_gate_waiting",
      missingPrerequisites: [],
      nextAction: `Boundary Gate evidence recorded (${rating}), not yet competent -- human decision needed on retry or remediation.`,
      humanActionRequired: true,
    };
  }
  if (gate.eligible) {
    return {
      state: "boundary_gate_eligible",
      missingPrerequisites: [],
      nextAction: "Candidate is administratively eligible for the Boundary Gate; schedule/administer when ready.",
      humanActionRequired: false,
    };
  }

  // Still working through pre-Gate evidence.
  if (!isCompetent(latest, "candidate_agreement")) {
    return {
      state: "agreement_pending",
      missingPrerequisites: ["candidate_agreement"],
      nextAction: "Awaiting candidate_agreement evidence.",
      humanActionRequired: false,
    };
  }
  const missingPrePractice = missingFromList(latest, PRE_PRACTICE_TYPES);
  if (missingPrePractice.length > 0) {
    return {
      state: "training_active",
      missingPrerequisites: missingPrePractice,
      nextAction: `Candidate in training; outstanding pre-practice evidence: ${describeMissing(missingPrePractice)}.`,
      humanActionRequired: false,
    };
  }
  const missingPreGate = missingFromList(latest, PRE_GATE_TYPES);
  return {
    state: "practice_eligible",
    missingPrerequisites: missingPreGate,
    nextAction: `Candidate is eligible for Practice Facilitation / Toolkit Experience Assembly evidence; outstanding: ${describeMissing(missingPreGate)}.`,
    humanActionRequired: false,
  };
}

const STALE_DAYS = Number(process.env.CERTIFICATION_OPERATIONS_STALE_DAYS ?? 10);

/** States where the ball is in the CANDIDATE's court, so silence is worth a
 *  heads-up. A candidate waiting on a human decision (Boundary Gate or
 *  Practicum result, the certification decision) is not "quiet": that wait is
 *  already its own item, and calling it a stall too would say the same thing
 *  twice. */
const STATES_CONSIDERED_ACTIVE: OperationalState[] = [
  "agreement_pending",
  "training_active",
  "practice_eligible",
  "portfolio_incomplete",
];

/** Days a post-decision handoff step (the certification record, then Toolkit
 *  authorization) may take before it is worth a human's attention. One rule
 *  for the whole system: before this was consolidated, one agent used 4 days
 *  and another fired immediately for the same two conditions. */
const HANDOFF_GRACE_DAYS = Number(process.env.CERTIFICATION_HANDOFF_GRACE_DAYS ?? 4);

function ageInDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : (now - t) / 86_400_000;
}

/** Deterministic exception detection -- every exception here is triggered by
 *  an objective fact already computed above or read directly from a table;
 *  nothing here is a judgment call about the candidate. Exactly ONE exception
 *  per root cause (each has a stable `code`), so the same condition can never
 *  be reported twice. This is the single authoritative place the candidate
 *  pipeline's rules live. */
export function detectExceptions(args: {
  state: OperationalState;
  latest: Partial<Record<EvidenceType, EvidenceRow>>;
  decision: DecisionRow | null;
  certification: CertificationRow | null;
  toolkitAuthorizationStatus: PlatformAuthStatus;
  lastActivityAt: string | null;
  readyForReview?: boolean;
  /** True only for an account holding an active 'founder_test' entitlement
   *  (Dorian's designated test Guide). Skips ONE rule, mismatch_no_decision,
   *  because that account was set up for testing and has no real certification
   *  decision by design. Every other rule still applies to it. */
  designatedTestAccount?: boolean;
  now?: number;
}): CertificationException[] {
  const { state, latest, decision, certification, lastActivityAt } = args;
  const now = args.now ?? Date.now();
  const exceptions: CertificationException[] = [];

  // A critical fail recorded on any evidence: surfaced for a human decision
  // on candidacy standing, never acted on automatically.
  const criticalFails = hasCriticalFail(latest);
  if (criticalFails.length > 0) {
    exceptions.push({
      category: "FAILED",
      code: "critical_fail",
      detail: `Critical Fail recorded on: ${describeMissing(criticalFails)}. This needs a human decision on candidacy standing.`,
    });
  }

  // An attempt recorded without a competent result: a human decides retry or
  // remediation.
  if (state === "boundary_gate_waiting") {
    exceptions.push({ category: "HUMAN_DECISION_REQUIRED", code: "gate_waiting", detail: "Boundary Gate evidence is on file but not yet competent: a human decides retry or remediation." });
  }
  if (state === "practicum_waiting") {
    exceptions.push({ category: "HUMAN_DECISION_REQUIRED", code: "practicum_waiting", detail: "Observed Practicum evidence is on file but not yet competent: a human decides retry or remediation." });
  }

  // Ready for the human certification decision: the portfolio is
  // administratively complete, or Dorian himself marked the candidate ready,
  // and no 'certified' decision exists yet. One item whichever applies.
  const portfolioComplete = state === "ready_for_human_review";
  const flagged = !!args.readyForReview && decision?.decision !== "certified" && state !== "lifecycle_closed";
  if (portfolioComplete || flagged) {
    exceptions.push({
      category: "HUMAN_DECISION_REQUIRED",
      code: "ready_for_review",
      detail: [portfolioComplete ? "every evidence step has a competent record" : null, flagged ? "you marked this candidate ready" : null]
        .filter(Boolean)
        .join("; "),
    });
  }

  // An inconsistency between two records, not a judgment about the candidate:
  // a certification exists with no recorded certification decision.
  if (certification && !decision && !args.designatedTestAccount) {
    exceptions.push({
      category: "MISMATCH",
      code: "mismatch_no_decision",
      detail: "A certification record exists with no certification decision on file.",
    });
  }

  // Post-decision handoff, with one shared grace period.
  if (decision?.decision === "certified") {
    if (!certification) {
      const age = ageInDays(decision.decision_date, now);
      if (age !== null && age >= HANDOFF_GRACE_DAYS) {
        exceptions.push({
          category: "MISSING",
          code: "missing_certification",
          detail: `A 'certified' decision was recorded ${Math.floor(age)} day(s) ago but the certification record has not been granted yet.`,
        });
      }
    } else if (certification.standing === "active" && args.toolkitAuthorizationStatus !== "authorized") {
      const age = ageInDays(certification.certified_at, now);
      if (age !== null && age >= HANDOFF_GRACE_DAYS) {
        exceptions.push({
          category: "HUMAN_DECISION_REQUIRED",
          code: "activation_pending",
          detail: `The certification has been active ${Math.floor(age)} day(s) but Toolkit authorization has not been granted yet.`,
        });
      }
    }
  }

  // No recorded activity within the stall window while the candidate is in an
  // otherwise-active state. Visibility only: the candidate has already been
  // gently checked in on (Companion check-ins, a separate support function).
  if (STATES_CONSIDERED_ACTIVE.includes(state) && lastActivityAt) {
    const ageDays = (now - new Date(lastActivityAt).getTime()) / 86_400_000;
    if (ageDays >= STALE_DAYS) {
      exceptions.push({ category: "STALE", code: "stale", detail: `No recorded activity in ${Math.floor(ageDays)} day(s) while in state "${state}".` });
    }
  }

  return exceptions;
}

type RawInputs = {
  candidates: CandidateRow[];
  evidenceRows: ({ candidate_id: string } & EvidenceRow)[];
  decisions: ({ host_id: string } & DecisionRow)[];
  certifications: ({ candidate_id: string; host_id: string } & CertificationRow)[];
  platformAuth: {
    host_id: string;
    capability: "toolkit" | "guided_journey_facilitation";
    status: "authorized" | "revoked";
    granted_at: string;
    status_changed_at: string | null;
  }[];
  profiles: ({ id: string } & ProfileRow)[];
  progressRows: { candidate_id: string; item_key: string; status: string; last_touched_at: string }[];
  curriculumCounts: { lessonsTotal: number; labsTotal: number };
  historyLastActivity: Map<string, string>;
  /** Hosts holding an active 'founder_test' entitlement (see detectExceptions). */
  designatedTestHostIds?: Set<string>;
  /** Optional clock for tests (defaults to the current time). */
  now?: number;
};

/** Builds one CertificationOperationsRecord per candidate from already-fetched
 *  rows (see lib/ops/certification-operations.ts for the admin-client fetch
 *  that supplies this). Kept as a pure function so the derived-state and
 *  exception logic above is independently testable from the I/O. */
export function buildCertificationOperationsRecords(inputs: RawInputs): CertificationOperationsRecord[] {
  const evidenceByCandidate = new Map<string, EvidenceRow[]>();
  for (const row of inputs.evidenceRows) {
    const arr = evidenceByCandidate.get(row.candidate_id) ?? [];
    arr.push(row);
    evidenceByCandidate.set(row.candidate_id, arr);
  }

  const decisionByHost = new Map(inputs.decisions.map((d) => [d.host_id, d]));
  const certificationByHost = new Map(inputs.certifications.map((c) => [c.host_id, c]));
  const profileById = new Map(inputs.profiles.map((p) => [p.id, p]));

  const latestAuthByHostCapability = new Map<string, PlatformAuthStatus>();
  const authRowTimestamp = (row: RawInputs["platformAuth"][number]) => new Date(row.status_changed_at ?? row.granted_at).getTime();
  for (const row of [...inputs.platformAuth].sort((a, b) => authRowTimestamp(a) - authRowTimestamp(b))) {
    latestAuthByHostCapability.set(`${row.host_id}:${row.capability}`, row.status);
  }

  const progressByCandidate = new Map<string, typeof inputs.progressRows>();
  for (const row of inputs.progressRows) {
    const arr = progressByCandidate.get(row.candidate_id) ?? [];
    arr.push(row);
    progressByCandidate.set(row.candidate_id, arr);
  }

  return inputs.candidates.map((candidate) => {
    const evidenceRows = evidenceByCandidate.get(candidate.id) ?? [];
    const latest = latestByType(evidenceRows);
    const decision = decisionByHost.get(candidate.host_id) ?? null;
    const certification = certificationByHost.get(candidate.host_id) ?? null;
    const profile = profileById.get(candidate.host_id) ?? null;
    const toolkitAuthorizationStatus = latestAuthByHostCapability.get(`${candidate.host_id}:toolkit`) ?? null;
    const journeyFacilitationAuthorizationStatus = latestAuthByHostCapability.get(`${candidate.host_id}:guided_journey_facilitation`) ?? null;

    const progressRows = progressByCandidate.get(candidate.id) ?? [];
    const lessonProgress = progressRows.filter((p) => p.item_key.startsWith("lesson-"));
    const labProgress = progressRows.filter((p) => p.item_key.startsWith("lab-"));
    const lastSelfReportedAt = progressRows.reduce<string | null>((latestTs, p) => {
      if (!latestTs || new Date(p.last_touched_at) > new Date(latestTs)) return p.last_touched_at;
      return latestTs;
    }, null);

    const evidenceLastActivity = evidenceRows.reduce<string | null>((latestTs, r) => {
      if (!latestTs || new Date(r.recorded_at) > new Date(latestTs)) return r.recorded_at;
      return latestTs;
    }, null);
    const historyActivity = inputs.historyLastActivity.get(candidate.id) ?? null;
    const candidates = [evidenceLastActivity, historyActivity, lastSelfReportedAt, candidate.admitted_at].filter(
      (d): d is string => !!d
    );
    const lastActivityAt = candidates.length
      ? candidates.reduce((latestTs, d) => (new Date(d) > new Date(latestTs) ? d : latestTs))
      : null;

    const { state, missingPrerequisites, nextAction, humanActionRequired } = deriveOperationalState({
      lifecycleStatus: candidate.status,
      latest,
      decision,
      certification,
      toolkitAuthorizationStatus,
    });

    const designatedTestAccount = inputs.designatedTestHostIds?.has(candidate.host_id) ?? false;

    const exceptions = detectExceptions({
      state,
      latest,
      decision,
      certification,
      toolkitAuthorizationStatus,
      lastActivityAt,
      readyForReview: candidate.ready_for_review,
      designatedTestAccount,
      now: inputs.now,
    });

    return {
      candidateId: candidate.id,
      hostId: candidate.host_id,
      lifecycleStatus: candidate.status,
      admittedAt: candidate.admitted_at,
      readyForReview: candidate.ready_for_review,
      readyForReviewNotes: candidate.ready_for_review_notes ?? null,
      progress: {
        lessonsSelfCheckedComplete: lessonProgress.filter((p) => p.status === "self_checked_complete").length,
        lessonsTotal: inputs.curriculumCounts.lessonsTotal,
        labsSelfCheckedComplete: labProgress.filter((p) => p.status === "self_checked_complete").length,
        labsTotal: inputs.curriculumCounts.labsTotal,
        lastSelfReportedAt,
      },
      latestEvidenceByType: latest,
      decision,
      certification,
      designatedTestAccount,
      profileRole: profile?.role ?? null,
      guideCertifiedAt: profile?.guide_certified_at ?? null,
      toolkitAuthorizationStatus,
      journeyFacilitationAuthorizationStatus,
      derivedState: state,
      missingPrerequisites,
      nextAction,
      humanActionRequired: humanActionRequired || exceptions.some((e) => e.category === "HUMAN_DECISION_REQUIRED" || e.category === "FAILED"),
      lastActivityAt,
      exceptions,
    };
  });
}

/** Single-candidate convenience wrapper -- reads everything this module
 *  needs for exactly one candidate via an RLS-respecting client (self or
 *  admin), for any future per-candidate surface. Not currently called by
 *  the admin list view (which batches, see lib/ops/certification-operations.ts)
 *  but kept so a candidate-count-of-one lookup never has to duplicate the
 *  batched query shape. It does not apply the designated-test-account
 *  exemption (an RLS client cannot read other accounts' entitlements); use the
 *  batched read for anything that decides what reaches Dorian. */
export async function getCertificationOperationsRecordForCandidate(
  supabase: SupabaseClient,
  candidateId: string
): Promise<CertificationOperationsRecord | null> {
  const { data: candidateRow } = await supabase
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at, ready_for_review, ready_for_review_notes")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidateRow) return null;
  const candidate = candidateRow as CandidateRow;

  const [{ data: evidenceRows }, { data: decisionRows }, { data: certificationRows }, { data: authRows }, { data: profileRows }, { data: progressRows }, { data: curriculumRows }, { data: historyRows }] =
    await Promise.all([
      supabase.from("guide_candidate_evidence").select("evidence_type, rating, recorded_by, recorded_at").eq("candidate_id", candidateId),
      supabase.from("guide_certification_decisions").select("decision, decision_date").eq("host_id", candidate.host_id).order("decision_date", { ascending: true }),
      supabase.from("guide_certifications").select("standing, certified_at").eq("host_id", candidate.host_id),
      supabase.from("guide_platform_authorizations").select("capability, status, granted_at, status_changed_at").eq("host_id", candidate.host_id),
      supabase.from("profiles").select("role, guide_certified_at").eq("id", candidate.host_id).maybeSingle(),
      supabase.from("certification_candidate_progress").select("item_key, status, last_touched_at").eq("candidate_id", candidateId),
      supabase.from("certification_curriculum_items").select("item_type"),
      supabase
        .from("guide_candidate_history")
        .select("recorded_at")
        .eq("candidate_id", candidateId)
        .order("recorded_at", { ascending: false })
        .limit(1),
    ]);

  void curriculumRows;
  const records = buildCertificationOperationsRecords({
    candidates: [candidate],
    evidenceRows: ((evidenceRows ?? []) as EvidenceRow[]).map((r) => ({ ...r, candidate_id: candidateId })),
    decisions: ((decisionRows ?? []) as DecisionRow[]).map((d) => ({ ...d, host_id: candidate.host_id })),
    certifications: ((certificationRows ?? []) as CertificationRow[]).map((c) => ({ ...c, candidate_id: candidateId, host_id: candidate.host_id })),
    platformAuth: ((authRows ?? []) as Omit<RawInputs["platformAuth"][number], "host_id">[]).map((a) => ({
      ...a,
      host_id: candidate.host_id,
    })),
    profiles: profileRows ? [{ id: candidate.host_id, ...(profileRows as ProfileRow) }] : [],
    progressRows: ((progressRows ?? []) as { item_key: string; status: string; last_touched_at: string }[]).map((p) => ({
      ...p,
      candidate_id: candidateId,
    })),
    curriculumCounts: {
      lessonsTotal: classroomCurriculumCounts().lessonsTotal,
      labsTotal: classroomCurriculumCounts().labsTotal,
    },
    historyLastActivity: new Map(
      (historyRows ?? []).length ? [[candidateId, (historyRows as { recorded_at: string }[])[0].recorded_at]] : []
    ),
  });

  return records[0] ?? null;
}

// ---------------------------------------------------------------------------
// Classroom integration (reconciled into production)
// ---------------------------------------------------------------------------

/** Curriculum totals for progress summaries, taken from the curriculum
 *  content itself so the three lessons the curriculum HOLDS (unresolved AVAIA
 *  policy, nothing to complete) never count toward "lessons to finish". */
export function classroomCurriculumCounts(): { lessonsTotal: number; labsTotal: number } {
  return { lessonsTotal: getCompletableLessons().length, labsTotal: getPracticeLabs().length };
}

export type StageState = "not_yet" | "reached" | "recorded";

export type CandidateStageSummary = {
  boundaryGate: StageState;
  observedPracticum: StageState;
  decision: StageState;
};

/** What the CANDIDATE is allowed to see about the stages after the
 *  education: whether each one has been reached or has a recorded outcome,
 *  and nothing more. It deliberately exposes no rating, no evaluator
 *  finding, and no pass/fail: those are communicated by a person. It reads
 *  only the mechanical record a human evaluator already entered; it never
 *  advances, passes, or schedules anything. */
export function describeCandidateStages(record: CertificationOperationsRecord | null): CandidateStageSummary {
  if (!record) return { boundaryGate: "not_yet", observedPracticum: "not_yet", decision: "not_yet" };
  const latest = record.latestEvidenceByType;
  const gate = boundaryGateEligibility(latest);
  const practicum = practicumEligibility(latest);
  return {
    boundaryGate: latest.boundary_gate ? "recorded" : gate.eligible ? "reached" : "not_yet",
    observedPracticum: latest.observed_practicum ? "recorded" : practicum.eligible ? "reached" : "not_yet",
    decision: record.decision ? "recorded" : "not_yet",
  };
}
