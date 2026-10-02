import { getAllCertificationOperationsRecords } from "@/lib/ops/certification-operations";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Certification Operations — AVAIA Admin" };
export const dynamic = "force-dynamic";

const STATE_LABELS: Record<string, string> = {
  agreement_pending: "Agreement pending",
  training_active: "Training active",
  practice_eligible: "Practice eligible",
  boundary_gate_eligible: "Boundary Gate eligible",
  boundary_gate_waiting: "Boundary Gate waiting",
  practicum_eligible: "Practicum eligible",
  practicum_waiting: "Practicum waiting",
  portfolio_incomplete: "Portfolio incomplete",
  ready_for_human_review: "READY FOR HUMAN CERTIFICATION REVIEW",
  decision_recorded: "Decision recorded",
  permission_activation_pending: "Permission activation pending",
  guide_handoff_complete: "Guide handoff complete",
  lifecycle_closed: "Lifecycle closed",
};

/** Admin-facing Certification Operations view -- the first /admin surface
 *  in this codebase (no /admin area existed before this build). Reads
 *  only; every value shown here is a mechanical fact or a deterministic
 *  derivation already computed by lib/certification-operations.ts, never a
 *  judgment this page makes itself. Evaluator free-text (evidence rows'
 *  own notes, if any existed) is never fetched or shown here -- only
 *  rating/recorded_at/recorded_by metadata, the same isolation boundary
 *  the Certification Companion observes in the other direction. */
export default async function AdminGuideCandidatesPage() {
  const records = await getAllCertificationOperationsRecords();

  const admin = createAdminClient();
  const hostIds = records.map((r) => r.hostId);
  const { data: profileRows } = hostIds.length
    ? await admin.from("profiles").select("id, guide_display_name").in("id", hostIds)
    : { data: [] as { id: string; guide_display_name: string | null }[] };
  const nameByHostId = new Map((profileRows ?? []).map((p) => [p.id, p.guide_display_name]));

  return (
    <div>
      <p className="label mb-3">Certification Operations</p>
      <h1 className="font-serif text-4xl text-ink">Guide Candidates</h1>
      <p className="mt-4 text-lg text-muted">
        Mechanical workflow state only. This page never decides competency, grades a Boundary Gate
        or Practicum, determines Critical Fail, or certifies anyone -- it surfaces what the
        existing certification records already say, for a human to act on.
      </p>

      {records.length === 0 && <p className="mt-12 text-muted">No certification candidates on file.</p>}

      <div className="mt-10 space-y-5">
        {records.map((r) => (
          <div key={r.candidateId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-serif text-lg text-ink">
                {nameByHostId.get(r.hostId) ?? r.hostId}
              </p>
              <span className="label text-muted">{r.lifecycleStatus}</span>
            </div>

            <p className="mt-2 text-sm text-ink">
              <span className="text-muted">Operational state: </span>
              {STATE_LABELS[r.derivedState] ?? r.derivedState}
            </p>

            <p className="mt-1 text-sm text-muted">
              Progress -- lessons {r.progress.lessonsSelfCheckedComplete}/{r.progress.lessonsTotal}, labs{" "}
              {r.progress.labsSelfCheckedComplete}/{r.progress.labsTotal} (candidate self-report only)
            </p>

            {r.missingPrerequisites.length > 0 && (
              <p className="mt-1 text-sm text-muted">Missing: {r.missingPrerequisites.join(", ")}</p>
            )}

            <p className="mt-2 text-sm text-ink">{r.nextAction}</p>

            <p className="mt-1 text-xs text-muted">
              Last activity: {r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString() : "unknown"}
              {r.humanActionRequired && <span className="ml-2 text-ink">&middot; Human action required</span>}
            </p>

            {Object.values(r.latestEvidenceByType).some((e) => e?.recorded_by) && (
              <p className="mt-1 text-xs text-muted">
                No evaluator/faculty directory exists yet in this schema -- recorded-by is shown as the raw
                account id of whoever last recorded evidence, not a resolved name.
              </p>
            )}

            {r.exceptions.length > 0 && (
              <div className="mt-3 border-t border-rule pt-3">
                <p className="label text-muted">Exceptions</p>
                <ul className="mt-1 space-y-1">
                  {r.exceptions.map((e, i) => (
                    <li key={i} className="text-sm text-ink">
                      <span className="font-semibold">{e.category}</span> -- {e.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
