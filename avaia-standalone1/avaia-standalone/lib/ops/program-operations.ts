import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProgramAuthorizationRecord,
  summarizeProgramAuthorizationRecords,
  toGuideFacingView,
  PROGRAM_LABELS,
  type Program,
  type ProgramAuthorizationRecord,
  type ProgramOperationsSummary,
  type ProgramExceptionCategory,
  type EvidenceRow,
  type EnrollmentStatus,
  type AuthorizationStanding,
  type GuideFacingProgramAuthorizationView,
} from "@/lib/program-operations";

/**
 * Program Operations Agent -- admin-client batched fetch + daily cron
 * notification, mirroring lib/ops/certification-operations.ts's own
 * shape exactly: one admin-client pass over the relevant tables, pure
 * derivation in lib/program-operations.ts, then a cooldown-gated sendFn
 * loop.
 *
 * REUSE, NOT DUPLICATION: this module reads guide_certifications (the
 * core-certification prerequisite) and guide_platform_authorizations
 * (Guide Operations' own 'toolkit' capability fact, the same column
 * lib/guide.ts's hasAuthorizedPlatformCapability() and
 * lib/ops/guide-access-operations.ts already read) -- it never writes to
 * either table, and never duplicates Guide Operations' own mismatch
 * bookkeeping. Item 8's handoff rule is enforced by construction: nothing
 * here ever sets guide_platform_authorizations; a mismatch is only ever
 * reported, for Guide Operations (and a human) to close.
 */

const REMINDER_COOLDOWN_DAYS = Number(process.env.PROGRAM_OPERATIONS_REMINDER_COOLDOWN_DAYS ?? 3);

type EnrollmentRow = {
  id: string;
  host_id: string;
  program: Program;
  status: EnrollmentStatus;
  evaluator_id: string | null;
  ready_for_review: boolean;
  updated_at: string;
};

/** "Current" platform-authorization status for one host -- the same
 *  latest-by-status_changed_at (falling back to granted_at) rule
 *  lib/guide.ts's hasAuthorizedPlatformCapability() and
 *  lib/ops/certification-operations.ts both already use for this same
 *  append-only table. */
function resolveLatestToolkitAuthorized(
  rows: { status: string; granted_at: string; status_changed_at: string | null }[]
): boolean {
  let toolkitAuthorized = false;
  let latestAt = "";
  for (const row of rows) {
    const at = row.status_changed_at ?? row.granted_at;
    if (!latestAt || new Date(at).getTime() > new Date(latestAt).getTime()) {
      latestAt = at;
      toolkitAuthorized = row.status === "authorized";
    }
  }
  return toolkitAuthorized;
}

export async function getAllProgramOperationsRecords(): Promise<ProgramAuthorizationRecord[]> {
  const admin = createAdminClient();

  const [{ data: enrollmentRows }, { data: authRows }, { data: evidenceRows }, { data: certRows }, { data: toolkitAuthRows }] =
    await Promise.all([
      admin
        .from("program_authorization_enrollments")
        .select("id, host_id, program, status, evaluator_id, ready_for_review, updated_at"),
      admin.from("program_authorizations").select("enrollment_id, standing"),
      admin.from("program_authorization_evidence").select("enrollment_id, evidence_type, rating, recorded_at"),
      admin.from("guide_certifications").select("host_id, standing"),
      admin
        .from("guide_platform_authorizations")
        .select("host_id, status, granted_at, status_changed_at")
        .eq("capability", "toolkit"),
    ]);

  const enrollments = (enrollmentRows ?? []) as EnrollmentRow[];

  const authByEnrollment = new Map<string, AuthorizationStanding>();
  for (const row of (authRows ?? []) as { enrollment_id: string; standing: AuthorizationStanding }[]) {
    authByEnrollment.set(row.enrollment_id, row.standing);
  }

  const evidenceByEnrollment = new Map<string, EvidenceRow[]>();
  for (const row of (evidenceRows ?? []) as {
    enrollment_id: string;
    evidence_type: EvidenceRow["evidenceType"];
    rating: EvidenceRow["rating"];
    recorded_at: string;
  }[]) {
    const list = evidenceByEnrollment.get(row.enrollment_id) ?? [];
    list.push({ evidenceType: row.evidence_type, rating: row.rating, recordedAt: row.recorded_at });
    evidenceByEnrollment.set(row.enrollment_id, list);
  }

  const activeCertByHost = new Set<string>();
  for (const row of (certRows ?? []) as { host_id: string; standing: string }[]) {
    if (row.standing === "active") activeCertByHost.add(row.host_id);
  }

  const toolkitRowsByHost = new Map<string, { status: string; granted_at: string; status_changed_at: string | null }[]>();
  for (const row of (toolkitAuthRows ?? []) as {
    host_id: string;
    status: string;
    granted_at: string;
    status_changed_at: string | null;
  }[]) {
    const list = toolkitRowsByHost.get(row.host_id) ?? [];
    list.push(row);
    toolkitRowsByHost.set(row.host_id, list);
  }

  return enrollments.map((e) => {
    const standing = authByEnrollment.get(e.id) ?? null;
    return buildProgramAuthorizationRecord({
      enrollmentId: e.id,
      hostId: e.host_id,
      program: e.program,
      status: e.status,
      evaluatorId: e.evaluator_id,
      readyForReview: e.ready_for_review,
      updatedAt: e.updated_at,
      hasActiveCertificationStanding: activeCertByHost.has(e.host_id),
      evidence: evidenceByEnrollment.get(e.id) ?? [],
      hasAuthorizationRow: standing !== null,
      authorizationStanding: standing,
      toolkitAuthorized: resolveLatestToolkitAuthorized(toolkitRowsByHost.get(e.host_id) ?? []),
    });
  });
}

export async function getProgramOperationsSummary(): Promise<{
  summary: ProgramOperationsSummary;
  records: ProgramAuthorizationRecord[];
}> {
  const records = await getAllProgramOperationsRecords();
  return { summary: summarizeProgramAuthorizationRecords(records), records };
}

/** Guide-facing only. Deliberately never reads program_authorization_evidence
 *  or program_authorization_history -- the candidate/evaluator isolation
 *  boundary is enforced here at the query level, not just by what the UI
 *  chooses to render, so a Guide-facing page literally cannot leak
 *  evaluator-only content even by mistake. Returns one entry per program
 *  this Guide has an enrollment in, plus a synthetic "available" entry for
 *  any of the two programs they have not yet enrolled in. */
export async function getGuideFacingProgramAuthorizations(hostId: string): Promise<GuideFacingProgramAuthorizationView[]> {
  const admin = createAdminClient();
  const [{ data: enrollmentRows }, { data: authRows }, { data: certRow }, { data: toolkitAuthRows }] = await Promise.all([
    admin
      .from("program_authorization_enrollments")
      .select("id, program, status, evaluator_id, ready_for_review, updated_at")
      .eq("host_id", hostId),
    admin.from("program_authorizations").select("enrollment_id, standing"),
    admin.from("guide_certifications").select("standing").eq("host_id", hostId).maybeSingle(),
    admin.from("guide_platform_authorizations").select("status, granted_at, status_changed_at").eq("host_id", hostId).eq("capability", "toolkit"),
  ]);

  const hasActiveCertificationStanding = certRow?.standing === "active";
  const toolkitAuthorized = resolveLatestToolkitAuthorized(
    (toolkitAuthRows ?? []) as { status: string; granted_at: string; status_changed_at: string | null }[]
  );

  const authByEnrollment = new Map<string, AuthorizationStanding>();
  for (const row of (authRows ?? []) as { enrollment_id: string; standing: AuthorizationStanding }[]) {
    authByEnrollment.set(row.enrollment_id, row.standing);
  }

  const enrollments = (enrollmentRows ?? []) as {
    id: string;
    program: Program;
    status: EnrollmentStatus;
    evaluator_id: string | null;
    ready_for_review: boolean;
    updated_at: string;
  }[];

  const seenPrograms = new Set<Program>();
  const views: GuideFacingProgramAuthorizationView[] = [];

  for (const e of enrollments) {
    seenPrograms.add(e.program);
    const standing = authByEnrollment.get(e.id) ?? null;
    const record = buildProgramAuthorizationRecord({
      enrollmentId: e.id,
      hostId,
      program: e.program,
      status: e.status,
      evaluatorId: e.evaluator_id,
      readyForReview: e.ready_for_review,
      updatedAt: e.updated_at,
      hasActiveCertificationStanding,
      evidence: [],
      hasAuthorizationRow: standing !== null,
      authorizationStanding: standing,
      toolkitAuthorized,
    });
    views.push(toGuideFacingView(record));
  }

  for (const program of ["defying_grief", "unsung_heroes"] as Program[]) {
    if (!seenPrograms.has(program)) {
      views.push({ program, label: PROGRAM_LABELS[program], state: "available" });
    }
  }

  return views;
}

export type ProgramReminderType =
  | "evaluator_task_reminder"
  | "ready_for_review_notification"
  | "stale_training_reminder"
  | "human_decision_notification"
  | "reassessment_reminder"
  | "permission_mismatch_alert";

function reminderTypeForException(category: ProgramExceptionCategory): ProgramReminderType | null {
  switch (category) {
    case "HUMAN_DECISION_REQUIRED":
      return "ready_for_review_notification";
    case "STALE":
      return "stale_training_reminder";
    case "MISMATCH":
      return "permission_mismatch_alert";
    case "MISSING":
    case "WAITING":
      return "evaluator_task_reminder";
    // FAILED is surfaced to the Founder Digest, not re-nagged here.
    // POLICY_REQUIRED (prerequisite not met) is informational, not
    // something a reminder can fix -- only a human enrolling a Guide
    // after certification resolves it.
    case "FAILED":
    case "POLICY_REQUIRED":
    default:
      return null;
  }
}

async function withinCooldown(
  admin: ReturnType<typeof createAdminClient>,
  enrollmentId: string,
  reminderType: ProgramReminderType
): Promise<boolean> {
  const { data } = await admin
    .from("program_authorization_reminders")
    .select("sent_at")
    .eq("enrollment_id", enrollmentId)
    .eq("reminder_type", reminderType)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  const days = (Date.now() - new Date(data.sent_at).getTime()) / 86_400_000;
  return days < REMINDER_COOLDOWN_DAYS;
}

export type ProgramOperationsNotification = {
  enrollmentId: string;
  hostId: string;
  program: Program;
  reminderType: ProgramReminderType;
  category: ProgramExceptionCategory;
  reason: string;
};

/** Cron body. Sends at most one reminder per enrollment per reminder type
 *  per cooldown window -- same posture as every other *_reminders table
 *  in this codebase. sendFn is expected to notify admin/evaluator/ops
 *  only; this function never contacts a Guide directly and never writes
 *  to any table other than program_authorization_reminders. */
export async function sendProgramOperationsReminders(
  sendFn: (n: ProgramOperationsNotification) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number; failed: number }> {
  const admin = createAdminClient();
  const records = await getAllProgramOperationsRecords();

  let sent = 0;
  let skippedCooldown = 0;
  let failed = 0;

  for (const r of records) {
    if (!r.exception) continue;
    const reminderType = reminderTypeForException(r.exception.category);
    if (!reminderType) continue;

    if (await withinCooldown(admin, r.enrollmentId, reminderType)) {
      skippedCooldown += 1;
      continue;
    }

    try {
      await sendFn({
        enrollmentId: r.enrollmentId,
        hostId: r.hostId,
        program: r.program,
        reminderType,
        category: r.exception.category,
        reason: r.exception.reason,
      });
      await admin.from("program_authorization_reminders").insert({ enrollment_id: r.enrollmentId, reminder_type: reminderType });
      sent += 1;
    } catch (e) {
      console.error(`Program Operations reminder failed (${reminderType} for enrollment ${r.enrollmentId}):`, e);
      failed += 1;
    }
  }

  return { sent, skippedCooldown, failed };
}
