import { getProgramOperationsSummary } from "@/lib/ops/program-operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROGRAM_LABELS, type ProgramAuthorizationRecord, type ProgramDerivedState } from "@/lib/program-operations";

export const metadata = { title: "Program Operations — AVAIA Admin" };
export const dynamic = "force-dynamic";

const GROUP_ORDER: { state: ProgramDerivedState; label: string }[] = [
  { state: "permission_mismatch", label: "Permission Mismatch" },
  { state: "ready_for_human_review", label: "Ready for Human Authorization Review" },
  { state: "development_required", label: "Development Required" },
  { state: "prerequisite_not_met", label: "Prerequisite Not Met" },
  { state: "in_training", label: "In Training" },
  { state: "practice_evidence", label: "Practice / Evidence" },
  { state: "enrolled", label: "Enrolled" },
  { state: "not_authorized", label: "Not Authorized" },
  { state: "paused", label: "Paused" },
  { state: "withdrawn", label: "Withdrawn" },
];

const HEALTHY_STATES: ProgramDerivedState[] = ["authorized"];

/** Admin-facing Program Operations view -- extends /admin alongside
 *  Certification, Guide, Foundation, and Organization/Event Operations.
 *  Exceptions-first: an "authorized" (healthy) enrollment is collapsed to
 *  a count, never a judgment made here. Nothing on this page can create a
 *  program_authorizations row, change standing, or decide competency --
 *  it surfaces prerequisite/evidence/readiness facts so a human can make
 *  that decision elsewhere. The literal phrase this page ever shows for
 *  a record awaiting a decision is "Ready for Human Authorization
 *  Review" -- never "ready to authorize." */
export default async function AdminProgramOperationsPage() {
  const { summary, records } = await getProgramOperationsSummary();

  const admin = createAdminClient();
  const hostIds = Array.from(new Set(records.map((r) => r.hostId)));
  const { data: profileRows } = hostIds.length
    ? await admin.from("profiles").select("id, guide_display_name").in("id", hostIds)
    : { data: [] as { id: string; guide_display_name: string | null }[] };
  const nameByHostId = new Map((profileRows ?? []).map((p) => [p.id, p.guide_display_name]));

  const byState = new Map<ProgramDerivedState, ProgramAuthorizationRecord[]>();
  for (const r of records) {
    const arr = byState.get(r.derivedState) ?? [];
    arr.push(r);
    byState.set(r.derivedState, arr);
  }
  const healthyCount = HEALTHY_STATES.reduce((n, s) => n + (byState.get(s)?.length ?? 0), 0);

  return (
    <div>
      <p className="label mb-3">Program Operations</p>
      <h1 className="font-serif text-4xl text-ink">Specialty Program Authorizations</h1>
      <p className="mt-4 text-lg text-muted">
        Defying Grief and Unsung Heroes authorization -- enrollment, prerequisite, evidence, and
        evaluator review state for every Certified Guide pursuing a specialty program. This page
        runs the authorization process; it never grants one. A human authorization decision is the
        only thing that ever creates a program authorization.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: "Ready for human review", value: summary.readyForHumanReview },
          { label: "Development required", value: summary.developmentRequired },
          { label: "Stale training", value: summary.staleTraining },
          { label: "Permission mismatches", value: summary.permissionMismatches },
          { label: "Failed automation", value: summary.failedAutomation },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
            <p className="font-serif text-2xl text-ink">{s.value}</p>
            <p className="label mt-1 text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {records.length === 0 && <p className="mt-12 text-muted">No Program Operations enrollments on file.</p>}

      {GROUP_ORDER.map(({ state, label }) => {
        const group = byState.get(state) ?? [];
        if (group.length === 0) return null;
        return (
          <section key={state} className="mt-10">
            <p className="label text-muted">
              {label} ({group.length})
            </p>
            <div className="mt-3 space-y-5">
              {group.map((r) => (
                <div key={r.enrollmentId} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg text-ink">{nameByHostId.get(r.hostId) ?? r.hostId}</p>
                    <span className="label text-muted">{PROGRAM_LABELS[r.program]}</span>
                  </div>

                  <p className="mt-2 text-sm text-ink">
                    <span className="text-muted">Status: </span>
                    {r.status}
                    <span className="text-muted"> &middot; Evaluator: </span>
                    {r.evaluatorId ?? "unassigned"}
                    <span className="text-muted"> &middot; Evidence complete: </span>
                    {r.evidenceComplete ? "yes" : "no"}
                  </p>

                  {r.hasAuthorizationRow && (
                    <p className="mt-1 text-sm text-muted">
                      Authorization standing: {r.authorizationStanding} &middot; Toolkit platform capability:{" "}
                      {r.toolkitAuthorized ? "authorized" : "not authorized"}
                    </p>
                  )}

                  {r.exception && (
                    <div className="mt-3 border-t border-rule pt-3">
                      <p className="label text-muted">Exception</p>
                      <p className="mt-1 text-sm text-ink">
                        <span className="font-semibold">{r.exception.category}</span> -- {r.exception.reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {healthyCount > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Authorized ({healthyCount})</p>
          <p className="mt-2 text-sm text-muted">
            Active program authorizations with no handoff mismatch. Not listed individually.
          </p>
        </section>
      )}
    </div>
  );
}
