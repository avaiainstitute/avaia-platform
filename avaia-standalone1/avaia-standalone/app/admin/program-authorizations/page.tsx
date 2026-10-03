import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ENROLLMENT_STATUSES, PROGRAMS, PROGRAM_LABELS, type AuthorizationStanding, type EnrollmentStatus, type EvidenceRow, type Program } from "@/lib/program-operations";
import { hostLabels } from "@/lib/ops/host-labels";
import {
  enrollGuideInProgram,
  getAllProgramOperationsRecords,
  recordProgramAuthorization,
  recordProgramEvidence,
  setProgramAuthorizationStanding,
  updateEnrollment,
} from "@/lib/ops/program-operations";

export const metadata = { title: "Program Authorizations, AVAIA Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Program Operations, the human side: enroll a certified Guide in a program,
// record training, practice and evaluator evidence, mark an enrollment ready for
// human review, and, only here and only by a person, record the authorization.
// Nothing in AVAIA ever authorizes automatically; the system only reports where
// each enrollment stands.

const EVIDENCE_TYPES: EvidenceRow["evidenceType"][] = ["training_progress_check", "practice_facilitation", "observed_session", "evaluator_review", "reflection_debrief"];
const RATINGS: EvidenceRow["rating"][] = ["competent", "development_required", "critical_fail"];
const STANDINGS: AuthorizationStanding[] = ["active", "paused", "revoked"];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/program-authorizations");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return user.id;
}

const done = (ok: boolean, error?: string) => redirect(ok ? "/admin/program-authorizations?saved=1" : `/admin/program-authorizations?error=${encodeURIComponent(error ?? "failed")}`);

async function enrollAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const hostId = String(formData.get("hostId") ?? "");
  const program = String(formData.get("program") ?? "") as Program;
  if (!hostId || !PROGRAMS.includes(program)) done(false, "Choose a Guide and a program.");
  const r = await enrollGuideInProgram({ hostId, program, enrolledBy: actor, notes: String(formData.get("notes") ?? "") });
  done(r.ok, r.ok ? undefined : r.error);
}

async function updateAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const status = String(formData.get("status") ?? "") as EnrollmentStatus;
  if (!enrollmentId || !ENROLLMENT_STATUSES.includes(status)) done(false, "Invalid status.");
  const currentEvaluator = String(formData.get("currentEvaluatorId") ?? "") || null;
  const r = await updateEnrollment({
    enrollmentId,
    status,
    evaluatorId: formData.get("iAmEvaluator") === "on" ? actor : currentEvaluator,
    readyForReview: formData.get("readyForReview") === "on",
    readyForReviewNotes: String(formData.get("readyForReviewNotes") ?? ""),
    actorId: actor,
  });
  done(r.ok, r.ok ? undefined : r.error);
}

async function evidenceAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const evidenceType = String(formData.get("evidenceType") ?? "") as EvidenceRow["evidenceType"];
  const rating = String(formData.get("rating") ?? "") as EvidenceRow["rating"];
  if (!enrollmentId || !EVIDENCE_TYPES.includes(evidenceType) || !RATINGS.includes(rating)) done(false, "Invalid evidence.");
  const r = await recordProgramEvidence({ enrollmentId, evidenceType, rating, summary: String(formData.get("summary") ?? ""), recordedBy: actor });
  done(r.ok, r.ok ? undefined : r.error);
}

async function authorizeAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  if (!enrollmentId) done(false, "Missing enrollment.");
  const r = await recordProgramAuthorization({ enrollmentId, authorizedBy: actor });
  done(r.ok, r.ok ? undefined : r.error);
}

async function standingAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const standing = String(formData.get("standing") ?? "") as AuthorizationStanding;
  if (!enrollmentId || !STANDINGS.includes(standing)) done(false, "Invalid standing.");
  const r = await setProgramAuthorizationStanding({ enrollmentId, standing, notes: String(formData.get("notes") ?? ""), actorId: actor });
  done(r.ok, r.ok ? undefined : r.error);
}

export default async function AdminProgramAuthorizationsPage({ searchParams }: { searchParams: { error?: string; saved?: string } }) {
  await requireAdmin();
  const admin = createAdminClient();
  const records = await getAllProgramOperationsRecords();

  const [{ data: certified }, { data: evidenceRows }] = await Promise.all([
    admin.from("guide_certifications").select("host_id").eq("standing", "active"),
    records.length
      ? admin
          .from("program_authorization_evidence")
          .select("enrollment_id, evidence_type, rating, summary, recorded_at")
          .in("enrollment_id", records.map((r) => r.enrollmentId))
          .order("recorded_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const certifiedIds = ((certified ?? []) as { host_id: string }[]).map((c) => c.host_id);
  const label = await hostLabels([...certifiedIds, ...records.map((r) => r.hostId)]);
  const evidenceBy = new Map<string, { evidence_type: string; rating: string; summary: string; recorded_at: string }[]>();
  for (const e of (evidenceRows ?? []) as { enrollment_id: string; evidence_type: string; rating: string; summary: string; recorded_at: string }[]) {
    const list = evidenceBy.get(e.enrollment_id) ?? [];
    list.push(e);
    evidenceBy.set(e.enrollment_id, list);
  }
  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/operations" className="label hover:text-seal">
          ← Back to Operations
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Program Authorizations</h1>
      <p className="mt-4 text-lg text-muted">
        After core certification, a Guide is authorized for each specialty program (Defying Grief, Unsung Heroes) by a person, on recorded evidence. AVAIA never
        authorizes anyone automatically; it only shows where each enrollment stands.
      </p>
      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">Saved.</p>}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {searchParams.error === "failed" ? "That did not save. Please try again." : searchParams.error}
        </p>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Enroll a certified Guide</p>
        {certifiedIds.length === 0 ? (
          <p className="text-sm text-muted">No Guide currently holds an active certification.</p>
        ) : (
          <form action={enrollAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-white/[0.04] p-4">
            <div className="min-w-[200px] flex-1">
              <label className="label mb-1 block text-xs">Guide</label>
              <select name="hostId" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  Choose a Guide
                </option>
                {certifiedIds.map((id) => (
                  <option key={id} value={id} className="bg-[#05060b] text-ink">
                    {label(id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1 block text-xs">Program</label>
              <select name="program" required defaultValue="" className={fieldClass}>
                <option value="" disabled>
                  Choose
                </option>
                {PROGRAMS.map((p) => (
                  <option key={p} value={p} className="bg-[#05060b] text-ink">
                    {PROGRAM_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] hover:opacity-90">
              Enroll
            </button>
          </form>
        )}
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-6">
        <p className="label mb-3 text-muted">Enrollments ({records.length})</p>
        {records.length === 0 ? (
          <p className="text-sm text-muted">No one is enrolled in a program yet.</p>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <details key={r.enrollmentId} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3" open={!!r.exception && r.exception.category === "HUMAN_DECISION_REQUIRED"}>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span className="text-ink">
                    {label(r.hostId)} <span className="ml-1 text-xs text-muted">{PROGRAM_LABELS[r.program]}</span>
                  </span>
                  <span className="label text-seal">{r.derivedState.replace(/_/g, " ")}</span>
                </summary>
                {r.exception && <p className="mt-3 text-sm text-ink">{r.exception.reason}</p>}

                <p className="label mb-2 mt-4 text-xs text-muted">Evidence on record</p>
                {(evidenceBy.get(r.enrollmentId) ?? []).length === 0 ? (
                  <p className="text-sm text-muted">None yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted">
                    {(evidenceBy.get(r.enrollmentId) ?? []).map((e, i) => (
                      <li key={i}>
                        {e.evidence_type.replace(/_/g, " ")} · {e.rating.replace(/_/g, " ")} · {new Date(e.recorded_at).toLocaleDateString()}: {e.summary}
                      </li>
                    ))}
                  </ul>
                )}

                <form action={evidenceAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="enrollmentId" value={r.enrollmentId} />
                  <div>
                    <label className="label mb-1 block text-xs">Evidence</label>
                    <select name="evidenceType" defaultValue="practice_facilitation" className={fieldClass}>
                      {EVIDENCE_TYPES.map((t) => (
                        <option key={t} value={t} className="bg-[#05060b] text-ink">
                          {t.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Rating</label>
                    <select name="rating" defaultValue="competent" className={fieldClass}>
                      {RATINGS.map((t) => (
                        <option key={t} value={t} className="bg-[#05060b] text-ink">
                          {t.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="label mb-1 block text-xs">Summary</label>
                    <input name="summary" required className={fieldClass} />
                  </div>
                  <button type="submit" className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
                    Record evidence
                  </button>
                </form>

                <form action={updateAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="enrollmentId" value={r.enrollmentId} />
                  <input type="hidden" name="currentEvaluatorId" value={r.evaluatorId ?? ""} />
                  <div>
                    <label className="label mb-1 block text-xs">Status</label>
                    <select name="status" defaultValue={r.status} className={fieldClass}>
                      {ENROLLMENT_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[#05060b] text-ink">
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm text-ink">
                    <input type="checkbox" name="readyForReview" defaultChecked={r.readyForReview} />
                    Ready for human review
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm text-ink">
                    <input type="checkbox" name="iAmEvaluator" defaultChecked={!!r.evaluatorId} />
                    I am the evaluator
                  </label>
                  <div className="min-w-[160px] flex-1">
                    <label className="label mb-1 block text-xs">Note</label>
                    <input name="readyForReviewNotes" className={fieldClass} />
                  </div>
                  <button type="submit" className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
                    Save
                  </button>
                </form>

                {r.derivedState === "ready_for_human_review" && (
                  <form action={authorizeAction} className="mt-4">
                    <input type="hidden" name="enrollmentId" value={r.enrollmentId} />
                    <button type="submit" className="rounded-md bg-seal px-4 py-2 text-sm font-semibold text-[#05060b] hover:opacity-90">
                      Record authorization for {PROGRAM_LABELS[r.program]}
                    </button>
                    <p className="mt-1 text-xs text-muted">This is your decision. It creates the one record that means this Guide is authorized for this program.</p>
                  </form>
                )}

                {r.hasAuthorizationRow && (
                  <form action={standingAction} className="mt-4 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="enrollmentId" value={r.enrollmentId} />
                    <div>
                      <label className="label mb-1 block text-xs">Authorization standing</label>
                      <select name="standing" defaultValue={r.authorizationStanding ?? "active"} className={fieldClass}>
                        {STANDINGS.map((s) => (
                          <option key={s} value={s} className="bg-[#05060b] text-ink">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[160px] flex-1">
                      <label className="label mb-1 block text-xs">Note</label>
                      <input name="notes" className={fieldClass} />
                    </div>
                    <button type="submit" className="rounded-md border border-rule px-4 py-2 text-sm text-ink hover:border-seal">
                      Set standing
                    </button>
                  </form>
                )}
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
