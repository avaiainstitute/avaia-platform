import "server-only";

/**
 * The AVAIA Program Operations Agent -- typed, deterministic resolver for
 * post-certification specialty-program authorization (Defying Grief and
 * Unsung Heroes in this build). Audited against the current repository and
 * live schema before writing anything here (see the final report for the
 * full audit). Central audit finding this file is scoped to: no
 * per-program authorization concept existed anywhere -- only two coarse
 * platform capabilities ('toolkit', 'guided_journey_facilitation') gate
 * the entire Toolkit, with zero distinction between Defying Grief and
 * Unsung Heroes sections (app/toolkit/layout.tsx -> isGuideToolkitAuthorized
 * only).
 *
 * GOVERNING DISTINCTION enforced throughout this file: core certification
 * (guide_certifications.standing === 'active', read via
 * hasActiveCertificationStanding in lib/guide.ts) answers "can this person
 * occupy the Guide seat"; everything in this file answers "has this
 * Certified Guide learned and demonstrated how to facilitate this
 * particular program." A program_authorizations row is the ONLY fact that
 * ever means "authorized" -- enrollment status never includes an
 * 'authorized' value (see 0107_program_operations.sql), so this resolver
 * cannot accidentally treat "ready for review" as "authorized."
 *
 * HUMAN AUTHORIZATION BOUNDARY: every exported function here determines
 * prerequisites/evidence/readiness and reports MISSING/WAITING/STALE/
 * MISMATCH/FAILED/HUMAN_DECISION_REQUIRED/POLICY_REQUIRED. None of them
 * ever create a program_authorizations row, change standing, or decide
 * competency. The literal phrase this file emits is always "READY FOR
 * HUMAN AUTHORIZATION REVIEW" -- never "READY TO AUTHORIZE."
 *
 * CANDIDATE/EVALUATOR ISOLATION: toGuideFacingView() is the only function
 * a Guide-facing surface may call. It takes a full ProgramAuthorizationRecord
 * and returns a stripped view with no evidence, no history, no evaluator
 * identity, and no internal exception detail -- mirroring Certification
 * Companion's own candidate/evaluator split.
 */

export const PROGRAMS = ["defying_grief", "unsung_heroes"] as const;
export type Program = (typeof PROGRAMS)[number];

export const PROGRAM_LABELS: Record<Program, string> = {
  defying_grief: "Defying Grief",
  unsung_heroes: "Unsung Heroes",
};

export const ENROLLMENT_STATUSES = [
  "enrolled",
  "in_training",
  "practice_evidence",
  "ready_for_human_review",
  "development_required",
  "not_authorized",
  "paused",
  "withdrawn",
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export type AuthorizationStanding = "active" | "paused" | "revoked";

export type ProgramExceptionCategory =
  | "MISSING"
  | "WAITING"
  | "STALE"
  | "MISMATCH"
  | "FAILED"
  | "HUMAN_DECISION_REQUIRED"
  | "POLICY_REQUIRED";

export type ProgramException = { category: ProgramExceptionCategory; reason: string };

const STALE_DAYS = Number(process.env.PROGRAM_OPERATIONS_STALE_DAYS ?? 14);

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export type EvidenceRow = {
  evidenceType:
    | "training_progress_check"
    | "practice_facilitation"
    | "observed_session"
    | "evaluator_review"
    | "reflection_debrief";
  rating: "competent" | "development_required" | "critical_fail";
  recordedAt: string;
};

/** Evidence completeness: at least one practice/observed facilitation AND
 *  one non-critical-fail evaluator review. A critical_fail rating anywhere
 *  in the packet is surfaced but never averaged away -- see
 *  deriveProgramAuthorizationException, which forces development_required
 *  handling whenever hasCriticalFail is true. */
export function deriveEvidenceCompleteness(evidence: EvidenceRow[]): { complete: boolean; hasCriticalFail: boolean } {
  const hasCriticalFail = evidence.some((e) => e.rating === "critical_fail");
  const hasEvaluatorReview = evidence.some((e) => e.evidenceType === "evaluator_review" && e.rating !== "critical_fail");
  const hasPractice = evidence.some((e) => e.evidenceType === "practice_facilitation" || e.evidenceType === "observed_session");
  return { complete: !hasCriticalFail && hasEvaluatorReview && hasPractice, hasCriticalFail };
}

export type ProgramAuthorizationInput = {
  enrollmentId: string;
  hostId: string;
  program: Program;
  status: EnrollmentStatus;
  evaluatorId: string | null;
  readyForReview: boolean;
  updatedAt: string;
  /** From lib/guide.ts hasActiveCertificationStanding(). The core
   *  certification prerequisite -- never inferred from payment, training
   *  completion, or Toolkit access. */
  hasActiveCertificationStanding: boolean;
  evidence: EvidenceRow[];
  hasAuthorizationRow: boolean;
  authorizationStanding: AuthorizationStanding | null;
  /** From lib/guide.ts hasAuthorizedPlatformCapability(host, 'toolkit') --
   *  the underlying Guide Operations access fact, reused (never duplicated)
   *  to detect a Guide Operations handoff mismatch. */
  toolkitAuthorized: boolean;
};

export type ProgramDerivedState =
  | "prerequisite_not_met"
  | "enrolled"
  | "in_training"
  | "practice_evidence"
  | "development_required"
  | "ready_for_human_review"
  | "authorized"
  | "not_authorized"
  | "paused"
  | "withdrawn"
  | "permission_mismatch";

export type ProgramAuthorizationRecord = ProgramAuthorizationInput & {
  prerequisiteMet: boolean;
  evidenceComplete: boolean;
  hasCriticalFail: boolean;
  derivedState: ProgramDerivedState;
  exception: ProgramException | null;
};

/** Pure derivation of the single exception (if any) for one enrollment.
 *  Priority order: (1) a granted authorization's permission handoff status
 *  always takes precedence, since that is the operative state once a human
 *  has decided; (2) the core-certification prerequisite, which gates
 *  everything else per item 2; (3) a critical-fail evidence rating that
 *  hasn't moved the enrollment to development_required; (4) the human
 *  decision boundary itself (readyForReview); (5) missing evaluator
 *  assignment; (6) staleness; (7) evidence complete and waiting to advance. */
export function deriveProgramAuthorizationException(record: {
  prerequisiteMet: boolean;
  status: EnrollmentStatus;
  hasAuthorizationRow: boolean;
  authorizationStanding: AuthorizationStanding | null;
  toolkitAuthorized: boolean;
  readyForReview: boolean;
  evidenceComplete: boolean;
  hasCriticalFail: boolean;
  evaluatorId: string | null;
  updatedAt: string;
}): ProgramException | null {
  if (record.hasAuthorizationRow && record.authorizationStanding === "active") {
    if (!record.toolkitAuthorized) {
      return {
        category: "MISMATCH",
        reason:
          "Program authorization is active but the Guide's underlying Toolkit platform capability is not authorized -- Guide Operations handoff is incomplete.",
      };
    }
    return null;
  }

  if (record.hasAuthorizationRow && (record.authorizationStanding === "paused" || record.authorizationStanding === "revoked")) {
    if (record.toolkitAuthorized) {
      return {
        category: "MISMATCH",
        reason: `Program authorization is ${record.authorizationStanding} but the Guide's Toolkit platform capability is still authorized -- access has not been adjusted to match.`,
      };
    }
    return null;
  }

  if (!record.prerequisiteMet) {
    return {
      category: "POLICY_REQUIRED",
      reason: "No active Certified AVAIA Guide standing -- this enrollment cannot proceed until core certification is active.",
    };
  }

  if (record.status === "withdrawn" || record.status === "not_authorized" || record.status === "paused") {
    return null;
  }

  if (record.hasCriticalFail && record.status !== "development_required") {
    return {
      category: "MISMATCH",
      reason: "Evidence includes a critical-fail rating but enrollment status has not moved to Development Required.",
    };
  }

  if (record.readyForReview || record.status === "ready_for_human_review") {
    if (!record.evaluatorId) {
      return { category: "MISSING", reason: "Status is ready_for_human_review but no evaluator is assigned." };
    }
    return {
      category: "HUMAN_DECISION_REQUIRED",
      reason: "READY FOR HUMAN AUTHORIZATION REVIEW -- a human authorization decision is required.",
    };
  }

  if (
    (record.status === "enrolled" ||
      record.status === "in_training" ||
      record.status === "practice_evidence" ||
      record.status === "development_required") &&
    daysSince(record.updatedAt) >= STALE_DAYS
  ) {
    return {
      category: "STALE",
      reason: `No progress recorded in ${Math.floor(daysSince(record.updatedAt))} day(s) while status is ${record.status}.`,
    };
  }

  if (record.status === "practice_evidence" && record.evidenceComplete) {
    return {
      category: "WAITING",
      reason: "Evidence packet is complete -- enrollment is ready to be moved to evaluator review.",
    };
  }

  return null;
}

export function buildProgramAuthorizationRecord(input: ProgramAuthorizationInput): ProgramAuthorizationRecord {
  const { complete: evidenceComplete, hasCriticalFail } = deriveEvidenceCompleteness(input.evidence);
  const prerequisiteMet = input.hasActiveCertificationStanding;

  let derivedState: ProgramDerivedState;
  if (input.hasAuthorizationRow && input.authorizationStanding === "active") {
    derivedState = input.toolkitAuthorized ? "authorized" : "permission_mismatch";
  } else if (input.hasAuthorizationRow && (input.authorizationStanding === "paused" || input.authorizationStanding === "revoked")) {
    derivedState = input.toolkitAuthorized ? "permission_mismatch" : input.authorizationStanding === "paused" ? "paused" : "not_authorized";
  } else if (!prerequisiteMet) {
    derivedState = "prerequisite_not_met";
  } else if (input.status === "withdrawn") {
    derivedState = "withdrawn";
  } else if (input.status === "not_authorized") {
    derivedState = "not_authorized";
  } else if (input.status === "paused") {
    derivedState = "paused";
  } else if (input.readyForReview || input.status === "ready_for_human_review") {
    derivedState = "ready_for_human_review";
  } else if (input.status === "development_required") {
    derivedState = "development_required";
  } else if (input.status === "practice_evidence") {
    derivedState = "practice_evidence";
  } else if (input.status === "in_training") {
    derivedState = "in_training";
  } else {
    derivedState = "enrolled";
  }

  const exception = deriveProgramAuthorizationException({
    prerequisiteMet,
    status: input.status,
    hasAuthorizationRow: input.hasAuthorizationRow,
    authorizationStanding: input.authorizationStanding,
    toolkitAuthorized: input.toolkitAuthorized,
    readyForReview: input.readyForReview,
    evidenceComplete,
    hasCriticalFail,
    evaluatorId: input.evaluatorId,
    updatedAt: input.updatedAt,
  });

  return { ...input, prerequisiteMet, evidenceComplete, hasCriticalFail, derivedState, exception };
}

export type ProgramOperationsSummary = {
  readyForHumanReview: number;
  developmentRequired: number;
  staleTraining: number;
  permissionMismatches: number;
  failedAutomation: number;
};

export function summarizeProgramAuthorizationRecords(records: ProgramAuthorizationRecord[]): ProgramOperationsSummary {
  return {
    readyForHumanReview: records.filter((r) => r.exception?.category === "HUMAN_DECISION_REQUIRED").length,
    developmentRequired: records.filter((r) => r.derivedState === "development_required").length,
    staleTraining: records.filter((r) => r.exception?.category === "STALE").length,
    permissionMismatches: records.filter((r) => r.derivedState === "permission_mismatch").length,
    failedAutomation: records.filter((r) => r.exception?.category === "FAILED").length,
  };
}

/* ---------------------------------------------------------------------- */
/* Candidate/evaluator isolation boundary -- the ONLY function a          */
/* Guide-facing surface may call. Strips evidence, history, evaluator     */
/* identity, and internal exception detail.                               */
/* ---------------------------------------------------------------------- */

export type GuideFacingAuthorizationState =
  | "available"
  | "in_training"
  | "development_required"
  | "awaiting_human_review"
  | "authorized"
  | "not_authorized"
  | "paused"
  | "withdrawn";

export type GuideFacingProgramAuthorizationView = {
  program: Program;
  label: string;
  state: GuideFacingAuthorizationState;
};

const GUIDE_FACING_STATE_MAP: Record<ProgramDerivedState, GuideFacingAuthorizationState> = {
  prerequisite_not_met: "available",
  enrolled: "in_training",
  in_training: "in_training",
  practice_evidence: "in_training",
  development_required: "development_required",
  ready_for_human_review: "awaiting_human_review",
  authorized: "authorized",
  not_authorized: "not_authorized",
  paused: "paused",
  withdrawn: "withdrawn",
  // A permission mismatch is a Guide Operations handoff concern for admin,
  // not something to surface to the Guide as a confusing extra state --
  // the authorization itself is real, so it reads as authorized here.
  permission_mismatch: "authorized",
};

export function toGuideFacingView(record: ProgramAuthorizationRecord): GuideFacingProgramAuthorizationView {
  return {
    program: record.program,
    label: PROGRAM_LABELS[record.program],
    state: GUIDE_FACING_STATE_MAP[record.derivedState],
  };
}
