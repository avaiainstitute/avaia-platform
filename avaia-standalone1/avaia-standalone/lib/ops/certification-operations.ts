import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildCertificationOperationsRecords,
  type CertificationOperationsRecord,
  type CandidateRow,
  type EvidenceRow,
  type DecisionRow,
  type CertificationRow,
  type ProfileRow,
  classroomCurriculumCounts,
} from "@/lib/certification-operations";

// Certification Operations: the one batched read of everything the candidate
// pipeline's rules need (lib/certification-operations.ts holds the rules
// themselves). Consumed by the single Needs-Dorian source
// (lib/ops/needs-dorian.ts). It reads status, stage, rating and timestamp
// metadata only -- never conversation content and never a candidate's
// workbook reflections -- and it never notifies, emails, or writes anything:
// telling Dorian is the Needs-Dorian source's job, in one place.

/** One batched read of every table lib/certification-operations.ts needs,
 *  across ALL candidates regardless of guide_candidates.status --
 *  this module also
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
    { data: testEntitlementRows },
  ] = await Promise.all([
    admin.from("guide_candidates").select("id, host_id, status, admitted_at, ready_for_review, ready_for_review_notes"),
    admin.from("guide_candidate_evidence").select("candidate_id, evidence_type, rating, recorded_by, recorded_at"),
    admin.from("guide_certification_decisions").select("host_id, decision, decision_date").order("decision_date", { ascending: true }),
    admin.from("guide_certifications").select("host_id, standing, certified_at"),
    admin.from("guide_platform_authorizations").select("host_id, capability, status, granted_at, status_changed_at"),
    admin.from("profiles").select("id, role, guide_certified_at"),
    admin.from("certification_candidate_progress").select("candidate_id, item_key, status, last_touched_at"),
    admin.from("certification_curriculum_items").select("item_type"),
    admin.from("guide_candidate_history").select("candidate_id, recorded_at").order("recorded_at", { ascending: false }),
    // Accounts Dorian designated as test accounts (active founder_test entitlement,
    // same "active" meaning as lib/membership.ts).
    admin
      .from("entitlements")
      .select("host_id")
      .eq("source", "founder_test")
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
  ]);

  void curriculumRows;

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
      lessonsTotal: classroomCurriculumCounts().lessonsTotal,
      labsTotal: classroomCurriculumCounts().labsTotal,
    },
    historyLastActivity,
    designatedTestHostIds: new Set(((testEntitlementRows ?? []) as { host_id: string }[]).map((r) => r.host_id)),
  });
}
