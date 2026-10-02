import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCertificationOperationsRecords,
  type CertificationOperationsRecord,
  type CertificationException,
  type CandidateRow,
  type EvidenceRow,
  type DecisionRow,
  type CertificationRow,
  type ProfileRow,
} from "@/lib/certification-operations";

// Certification Operations Agent -- admin-client batched fetch + daily
// cron notification. Mirrors lib/ops/guide-operations.ts's own shape
// exactly: one admin-client pass over the relevant tables, pure-function
// derivation (lib/certification-operations.ts), then a cooldown-gated
// sendFn loop that only ever notifies admin/ops, never the candidate, and
// never writes back a judgment -- it records that an exception was
// surfaced, nothing about the candidate's standing.

const COOLDOWN_DAYS = Number(process.env.CERTIFICATION_OPERATIONS_COOLDOWN_DAYS ?? 3);

/** One batched read of every table lib/certification-operations.ts needs,
 *  across ALL candidates regardless of guide_candidates.status -- unlike
 *  guide-operations.ts's OPEN_CANDIDACY_STATUSES filter, this module also
 *  has to catch post-certification handoff mismatches, which by
 *  definition occur after a candidate's workflow would otherwise look
 *  closed. deriveOperationalState already handles a withdrawn/
 *  not_currently_eligible candidacy correctly (state: "lifecycle_closed"),
 *  so no status filter is needed here. */
export async function getAllCertificationOperationsRecords(): Promise<CertificationOperationsRecord[]> {
  const admin = createAdminClient();

  const [
    { data: candidateRows },
    { data: evidenceRows },
    { data: decisionRows },
    { data: certificationRows },
    { data: authRows },
    { data: profileRows },
    { data: progressRows },
    { data: curriculumRows },
    { data: historyRows },
  ] = await Promise.all([
    admin.from("guide_candidates").select("id, host_id, status, admitted_at, ready_for_review, ready_for_review_notes"),
    admin.from("guide_candidate_evidence").select("candidate_id, evidence_type, rating, recorded_by, recorded_at"),
    admin.from("guide_certification_decisions").select("host_id, decision, decision_date"),
    admin.from("guide_certifications").select("host_id, standing, certified_at"),
    admin.from("guide_platform_authorizations").select("host_id, capability, status, granted_at, status_changed_at"),
    admin.from("profiles").select("id, role, guide_certified_at"),
    admin.from("certification_candidate_progress").select("candidate_id, item_key, status, last_touched_at"),
    admin.from("certification_curriculum_items").select("item_type"),
    admin.from("guide_candidate_history").select("candidate_id, recorded_at").order("recorded_at", { ascending: false }),
  ]);

  const curriculum = (curriculumRows ?? []) as { item_type: string }[];

  const historyLastActivity = new Map<string, string>();
  for (const row of (historyRows ?? []) as { candidate_id: string; recorded_at: string }[]) {
    if (!historyLastActivity.has(row.candidate_id)) historyLastActivity.set(row.candidate_id, row.recorded_at);
  }

  return buildCertificationOperationsRecords({
    candidates: (candidateRows ?? []) as CandidateRow[],
    evidenceRows: (evidenceRows ?? []) as ({ candidate_id: string } & EvidenceRow)[],
    decisions: (decisionRows ?? []) as ({ host_id: string } & DecisionRow)[],
    certifications: (certificationRows ?? []) as ({ candidate_id: string; host_id: string } & CertificationRow)[],
    platformAuth: (authRows ?? []) as {
      host_id: string;
      capability: "toolkit" | "guided_journey_facilitation";
      status: "authorized" | "revoked";
      granted_at: string;
      status_changed_at: string | null;
    }[],
    profiles: (profileRows ?? []) as ({ id: string } & ProfileRow)[],
    progressRows: (progressRows ?? []) as { candidate_id: string; item_key: string; status: string; last_touched_at: string }[],
    curriculumCounts: {
      lessonsTotal: curriculum.filter((c) => c.item_type === "lesson").length,
      labsTotal: curriculum.filter((c) => c.item_type === "practice_lab").length,
    },
    historyLastActivity,
  });
}

/** Concise summary for the founder/ops digest -- counts only, no evaluator
 *  content, no candidate names beyond IDs already visible to admin. */
export type CertificationOperationsSummary = {
  inTraining: number;
  stalled: number;
  boundaryGateAwaitingHuman: number;
  practicumAwaitingHuman: number;
  readyForReview: number;
  permissionMismatches: number;
  failedAutomations: number;
};

export async function getCertificationOperationsSummary(): Promise<{
  summary: CertificationOperationsSummary;
  records: CertificationOperationsRecord[];
}> {
  const records = await getAllCertificationOperationsRecords();

  const summary: CertificationOperationsSummary = {
    inTraining: records.filter((r) => r.derivedState === "training_active" || r.derivedState === "practice_eligible").length,
    stalled: records.filter((r) => r.exceptions.some((e) => e.category === "STALE")).length,
    boundaryGateAwaitingHuman: records.filter((r) => r.derivedState === "boundary_gate_waiting").length,
    practicumAwaitingHuman: records.filter((r) => r.derivedState === "practicum_waiting").length,
    readyForReview: records.filter((r) => r.derivedState === "ready_for_human_review").length,
    permissionMismatches: records.filter((r) => r.exceptions.some((e) => e.category === "MISMATCH" || e.category === "POLICY_REQUIRED")).length,
    failedAutomations: records.filter((r) => r.exceptions.some((e) => e.category === "FAILED")).length,
  };

  return { summary, records };
}

export type CertificationOperationsNotification = {
  candidateId: string;
  hostId: string;
  derivedState: CertificationOperationsRecord["derivedState"];
  exception: CertificationException;
};

/** Daily cron body -- same cooldown/idempotency shape as
 *  recordGuideOperationsReminders (lib/ops/guide-operations.ts): one
 *  certification_operations_exceptions row per (candidate, category) per
 *  notification, never repeated inside COOLDOWN_DAYS. sendFn is expected
 *  to notify admin/ops only (see app/api/cron/certification-operations/
 *  route.ts) -- this function never contacts a candidate and never writes
 *  to any table other than certification_operations_exceptions. */
export async function recordCertificationOperationsExceptions(
  sendFn: (n: CertificationOperationsNotification) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const records = await getAllCertificationOperationsRecords();

  let sent = 0;
  let skippedCooldown = 0;

  for (const record of records) {
    for (const exception of record.exceptions) {
      const { data: lastRow } = await admin
        .from("certification_operations_exceptions")
        .select("sent_at")
        .eq("candidate_id", record.candidateId)
        .eq("category", exception.category)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastRow) {
        const daysSince = (Date.now() - new Date(lastRow.sent_at).getTime()) / 86_400_000;
        if (daysSince < COOLDOWN_DAYS) {
          skippedCooldown += 1;
          continue;
        }
      }

      await sendFn({
        candidateId: record.candidateId,
        hostId: record.hostId,
        derivedState: record.derivedState,
        exception,
      });
      await admin.from("certification_operations_exceptions").insert({
        candidate_id: record.candidateId,
        host_id: record.hostId,
        category: exception.category,
        detail: exception.detail,
        derived_state: record.derivedState,
      });
      sent += 1;
    }
  }

  return { sent, skippedCooldown };
}
