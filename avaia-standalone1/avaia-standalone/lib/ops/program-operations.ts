import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProgramAuthorizationRecord,
  PROGRAM_LABELS,
  toGuideFacingView,
  type AuthorizationStanding,
  type EnrollmentStatus,
  type EvidenceRow,
  type GuideFacingProgramAuthorizationView,
  type Program,
  type ProgramAuthorizationRecord,
} from "@/lib/program-operations";
import { hostLabels } from "@/lib/ops/host-labels";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";

// PROGRAM OPERATIONS, as an operational capability. After a Guide holds core
// certification, this runs the authorization process for each specialty program
// (Defying Grief and Unsung Heroes today): enrollment, training progress,
// practice and observed evidence, evaluator review, and the human decision.
//
// THE RULE THAT NEVER BENDS: AUTOMATION NEVER AUTHORIZES. No enrollment status
// means "authorized"; only a program_authorizations row, created by a person
// pressing "Record authorization" (app/admin/program-authorizations), does. The
// system only reports prerequisites, evidence and readiness, using the phrase
// "ready for human authorization review", never "ready to authorize".
//
// What a person must act on goes to What Needs Dorian; a Guide sees only the
// state of their own authorization (never the evidence, history, or evaluator).

type EnrollmentRow = {
  id: string;
  host_id: string;
  program: Program;
  status: EnrollmentStatus;
  evaluator_id: string | null;
  ready_for_review: boolean;
  updated_at: string;
};

/** Current Toolkit authorization for one host (latest row wins), the same rule
 *  lib/guide.ts and the certification pipeline already use for this append-only table. */
function latestToolkitAuthorized(rows: { status: string; granted_at: string; status_changed_at: string | null }[]): boolean {
  let authorized = false;
  let latestAt = "";
  for (const row of rows) {
    const at = row.status_changed_at ?? row.granted_at;
    if (!latestAt || new Date(at).getTime() > new Date(latestAt).getTime()) {
      latestAt = at;
      authorized = row.status === "authorized";
    }
  }
  return authorized;
}

export async function getAllProgramOperationsRecords(): Promise<ProgramAuthorizationRecord[]> {
  const admin = createAdminClient();

  const [{ data: enrollmentRows }, { data: authRows }, { data: evidenceRows }, { data: certRows }, { data: toolkitAuthRows }] = await Promise.all([
    admin.from("program_authorization_enrollments").select("id, host_id, program, status, evaluator_id, ready_for_review, updated_at"),
    admin.from("program_authorizations").select("enrollment_id, standing"),
    admin.from("program_authorization_evidence").select("enrollment_id, evidence_type, rating, recorded_at"),
    admin.from("guide_certifications").select("host_id, standing"),
    admin.from("guide_platform_authorizations").select("host_id, status, granted_at, status_changed_at").eq("capability", "toolkit"),
  ]);

  const authByEnrollment = new Map<string, AuthorizationStanding>();
  for (const row of (authRows ?? []) as { enrollment_id: string; standing: AuthorizationStanding }[]) authByEnrollment.set(row.enrollment_id, row.standing);

  const evidenceByEnrollment = new Map<string, EvidenceRow[]>();
  for (const row of (evidenceRows ?? []) as { enrollment_id: string; evidence_type: EvidenceRow["evidenceType"]; rating: EvidenceRow["rating"]; recorded_at: string }[]) {
    const list = evidenceByEnrollment.get(row.enrollment_id) ?? [];
    list.push({ evidenceType: row.evidence_type, rating: row.rating, recordedAt: row.recorded_at });
    evidenceByEnrollment.set(row.enrollment_id, list);
  }

  const activeCertByHost = new Set<string>();
  for (const row of (certRows ?? []) as { host_id: string; standing: string }[]) if (row.standing === "active") activeCertByHost.add(row.host_id);

  const toolkitRowsByHost = new Map<string, { status: string; granted_at: string; status_changed_at: string | null }[]>();
  for (const row of (toolkitAuthRows ?? []) as { host_id: string; status: string; granted_at: string; status_changed_at: string | null }[]) {
    const list = toolkitRowsByHost.get(row.host_id) ?? [];
    list.push(row);
    toolkitRowsByHost.set(row.host_id, list);
  }

  return ((enrollmentRows ?? []) as EnrollmentRow[]).map((e) => {
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
      toolkitAuthorized: latestToolkitAuthorized(toolkitRowsByHost.get(e.host_id) ?? []),
    });
  });
}

/** Guide-facing only. Deliberately never reads program_authorization_evidence or
 *  program_authorization_history: the isolation between a Guide and their evaluator
 *  is enforced here at the query level, not just by what a page chooses to render. */
export async function getGuideFacingProgramAuthorizations(hostId: string): Promise<GuideFacingProgramAuthorizationView[]> {
  const admin = createAdminClient();
  const [{ data: enrollmentRows }, { data: authRows }, { data: certRow }, { data: toolkitAuthRows }] = await Promise.all([
    admin.from("program_authorization_enrollments").select("id, program, status, evaluator_id, ready_for_review, updated_at").eq("host_id", hostId),
    admin.from("program_authorizations").select("enrollment_id, standing").eq("host_id", hostId),
    admin.from("guide_certifications").select("standing").eq("host_id", hostId).maybeSingle(),
    admin.from("guide_platform_authorizations").select("status, granted_at, status_changed_at").eq("host_id", hostId).eq("capability", "toolkit"),
  ]);

  const hasActiveCertificationStanding = (certRow as { standing?: string } | null)?.standing === "active";
  const toolkitAuthorized = latestToolkitAuthorized((toolkitAuthRows ?? []) as { status: string; granted_at: string; status_changed_at: string | null }[]);
  const authByEnrollment = new Map<string, AuthorizationStanding>();
  for (const row of (authRows ?? []) as { enrollment_id: string; standing: AuthorizationStanding }[]) authByEnrollment.set(row.enrollment_id, row.standing);

  const seen = new Set<Program>();
  const views: GuideFacingProgramAuthorizationView[] = [];
  for (const e of (enrollmentRows ?? []) as Omit<EnrollmentRow, "host_id">[]) {
    seen.add(e.program);
    const standing = authByEnrollment.get(e.id) ?? null;
    views.push(
      toGuideFacingView(
        buildProgramAuthorizationRecord({
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
        })
      )
    );
  }
  for (const program of ["defying_grief", "unsung_heroes"] as Program[]) {
    if (!seen.has(program)) views.push({ program, label: PROGRAM_LABELS[program], state: "available" });
  }
  return views;
}

// ---------------------------------------------------------------------------
// The capability
// ---------------------------------------------------------------------------

/** Pure: turns enrollment records into the capability result. */
export function classifyProgramOperations(records: ProgramAuthorizationRecord[], label: (hostId: string) => string): CapabilityResult {
  const decisions: NeedsItem[] = [];
  const people: NeedsItem[] = [];
  const problems: NeedsItem[] = [];
  const watching: NeedsItem[] = [];
  const href = "/admin/program-authorizations";

  for (const r of records) {
    if (!r.exception) continue;
    const who = label(r.hostId);
    const program = PROGRAM_LABELS[r.program];
    const key = `program:${r.enrollmentId}:${r.exception.category}`;
    switch (r.exception.category) {
      case "HUMAN_DECISION_REQUIRED":
        decisions.push({ key, href, text: `${who}: ready for human authorization review for ${program}. Only you record the authorization.` });
        break;
      case "MISSING":
        people.push({ key, href, text: `${who}: ${program} enrollment is ready for review but no evaluator is assigned.` });
        break;
      case "WAITING":
        people.push({ key, href, text: `${who}: ${program} evidence is complete; the enrollment is ready to move to evaluator review.` });
        break;
      case "MISMATCH":
        problems.push({ key, href, text: `${who}: ${program}: ${r.exception.reason}` });
        break;
      case "STALE":
        watching.push({ key, href, text: `${who}: ${program}: ${r.exception.reason}` });
        break;
      case "POLICY_REQUIRED":
        watching.push({ key, href, text: `${who}: ${program} enrollment is waiting because the account has no active Certified Guide standing yet.` });
        break;
      default:
        watching.push({ key, href, text: `${who}: ${program}: ${r.exception.reason}` });
    }
  }
  return { key: "program_operations", label: "Program Operations", evaluated: records.length, decisions, people, problems, watching };
}

export async function evaluateProgramOperations(): Promise<CapabilityResult> {
  const records = await getAllProgramOperationsRecords();
  const label = await hostLabels(records.filter((r) => r.exception).map((r) => r.hostId));
  return classifyProgramOperations(records, label);
}

// ---------------------------------------------------------------------------
// Human actions (called only from app/admin/program-authorizations, after its
// own admin check). Nothing here is ever called by automation.
// ---------------------------------------------------------------------------

type Result = { ok: true } | { ok: false; error: string };

const fail = (e: { message: string } | null): Result => (e ? { ok: false, error: e.message } : { ok: true });

export async function enrollGuideInProgram(args: { hostId: string; program: Program; enrolledBy: string; notes?: string | null }): Promise<Result> {
  const admin = createAdminClient();
  const { data: cert } = await admin.from("guide_certifications").select("standing").eq("host_id", args.hostId).maybeSingle();
  if ((cert as { standing?: string } | null)?.standing !== "active") {
    return { ok: false, error: "This account does not hold an active Certified Guide standing, which every program authorization requires first." };
  }
  const { data: existing } = await admin
    .from("program_authorization_enrollments")
    .select("id")
    .eq("host_id", args.hostId)
    .eq("program", args.program)
    .not("status", "in", "(withdrawn,not_authorized)")
    .limit(1);
  if ((existing ?? []).length > 0) return { ok: false, error: "This Guide already has an open enrollment for that program." };
  const { error } = await admin
    .from("program_authorization_enrollments")
    .insert({ host_id: args.hostId, program: args.program, enrolled_by: args.enrolledBy, notes: args.notes?.trim() || null });
  return fail(error);
}

export async function updateEnrollment(args: {
  enrollmentId: string;
  status: EnrollmentStatus;
  evaluatorId: string | null;
  readyForReview: boolean;
  readyForReviewNotes?: string | null;
  actorId: string;
}): Promise<Result> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("program_authorization_enrollments")
    .update({
      status: args.status,
      evaluator_id: args.evaluatorId,
      ready_for_review: args.readyForReview,
      ready_for_review_notes: args.readyForReviewNotes?.trim() || null,
      ready_for_review_marked_at: args.readyForReview ? now : null,
      ready_for_review_marked_by: args.readyForReview ? args.actorId : null,
      updated_at: now,
    })
    .eq("id", args.enrollmentId);
  if (!error) {
    await admin.from("program_authorization_history").insert({
      enrollment_id: args.enrollmentId,
      entry_type: "status_change",
      body: `Status set to ${args.status}${args.readyForReview ? "; marked ready for human review" : ""}.`,
      recorded_by: args.actorId,
    });
  }
  return fail(error);
}

export async function recordProgramEvidence(args: {
  enrollmentId: string;
  evidenceType: EvidenceRow["evidenceType"];
  rating: EvidenceRow["rating"];
  summary: string;
  recordedBy: string;
}): Promise<Result> {
  if (!args.summary.trim()) return { ok: false, error: "A summary is required." };
  const admin = createAdminClient();
  const { error } = await admin
    .from("program_authorization_evidence")
    .insert({ enrollment_id: args.enrollmentId, evidence_type: args.evidenceType, rating: args.rating, summary: args.summary.trim(), recorded_by: args.recordedBy });
  if (!error) {
    await admin.from("program_authorization_enrollments").update({ updated_at: new Date().toISOString() }).eq("id", args.enrollmentId);
  }
  return fail(error);
}

/** The human authorization decision. Creates the one record that means "authorized".
 *  Requires an active certification and a status of ready_for_human_review. */
export async function recordProgramAuthorization(args: { enrollmentId: string; authorizedBy: string }): Promise<Result> {
  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("program_authorization_enrollments")
    .select("id, host_id, program, status")
    .eq("id", args.enrollmentId)
    .maybeSingle();
  const e = enrollment as { id: string; host_id: string; program: Program; status: EnrollmentStatus } | null;
  if (!e) return { ok: false, error: "Enrollment not found." };
  if (e.status !== "ready_for_human_review") return { ok: false, error: "An authorization can only be recorded once the enrollment is ready for human review." };
  const { data: cert } = await admin.from("guide_certifications").select("standing").eq("host_id", e.host_id).maybeSingle();
  if ((cert as { standing?: string } | null)?.standing !== "active") return { ok: false, error: "This Guide does not hold an active Certified Guide standing." };
  const { data: existing } = await admin.from("program_authorizations").select("id").eq("enrollment_id", e.id).limit(1);
  if ((existing ?? []).length > 0) return { ok: false, error: "An authorization is already recorded for this enrollment." };

  const { error } = await admin
    .from("program_authorizations")
    .insert({ enrollment_id: e.id, host_id: e.host_id, program: e.program, authorized_by: args.authorizedBy });
  if (!error) {
    await admin.from("program_authorization_history").insert({
      enrollment_id: e.id,
      entry_type: "decision_event",
      body: "Authorization recorded by a person.",
      recorded_by: args.authorizedBy,
    });
  }
  return fail(error);
}

export async function setProgramAuthorizationStanding(args: { enrollmentId: string; standing: AuthorizationStanding; notes?: string | null; actorId: string }): Promise<Result> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("program_authorizations")
    .update({ standing: args.standing, standing_changed_at: now, standing_changed_by: args.actorId, standing_notes: args.notes?.trim() || null })
    .eq("enrollment_id", args.enrollmentId);
  if (!error) {
    await admin.from("program_authorization_history").insert({
      enrollment_id: args.enrollmentId,
      entry_type: "decision_event",
      body: `Authorization standing set to ${args.standing}${args.notes?.trim() ? `: ${args.notes.trim()}` : ""}.`,
      recorded_by: args.actorId,
    });
  }
  return fail(error);
}
