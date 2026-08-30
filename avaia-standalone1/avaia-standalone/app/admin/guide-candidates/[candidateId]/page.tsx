import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Guide Candidate — AVAIA Admin" };
export const dynamic = "force-dynamic";

const HISTORY_ENTRY_LABEL: Record<string, string> = {
  note: "Note",
  status_change: "Status Change",
  development_event: "Development Event",
  evaluation_note: "Evaluation Note",
  certification_event: "Certification Event",
  document_received: "Document Received",
};

const VALID_STATUSES = [
  "admitted",
  "in_training",
  "development_required",
  "paused",
  "hold",
  "withdrawn",
  "not_certified",
] as const;
type CandidateStatus = (typeof VALID_STATUSES)[number];

// withdrawn/not_certified close a candidacy. Terminal in the ordinary
// lifecycle control below by design -- reopening a closed candidacy is
// deliberately not built in this phase (Phase C.3 scope).
const CLOSED_STATUSES: CandidateStatus[] = ["withdrawn", "not_certified"];

const STATUS_ERROR_MESSAGE: Record<string, string> = {
  invalid_status: "That is not a recognized candidate status.",
  closed: "This candidacy is closed and cannot be changed through this control.",
  no_change: "No change was made -- that is already the current status.",
  conflict: "The candidate's status changed since this page loaded. Please review and try again.",
  not_found: "Candidate not found.",
  update_failed: "Could not update this candidate's status. Please try again.",
};

// Exactly the 12 evidence_type values live in guide_candidate_evidence
// (0023) -- never change these without a schema change. Labels are
// display-only; the stored value is always the plain enum string.
const EVIDENCE_TYPES = [
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
type EvidenceType = (typeof EVIDENCE_TYPES)[number];

const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  candidate_agreement: "Candidate Agreement",
  foundations_knowledge_check: "Foundations Knowledge Check",
  judgment_scenarios: "Guide Judgment Scenarios",
  table_building_exercise: "Table-Building Exercise",
  recognition_assessment: "Recognition Without Diagnosis",
  conversation_review: "Conversation Review",
  practice_facilitation: "Practice Facilitation Evaluation",
  toolkit_experience_assembly: "Toolkit / Experience Assembly Assessment",
  boundary_gate: "Boundary Gate",
  observed_practicum: "Observed Practicum Evaluation",
  guides_record_sample: "Guide's Record / Documentation Sample",
  reflection_debrief: "Candidate Reflection + Debrief",
};

const RATINGS = ["competent", "development_required", "critical_fail"] as const;
type EvidenceRating = (typeof RATINGS)[number];

const RATING_LABEL: Record<EvidenceRating, string> = {
  competent: "Competent",
  development_required: "Development Required",
  critical_fail: "Critical Fail",
};

const EVIDENCE_ERROR_MESSAGE: Record<string, string> = {
  missing_candidate: "Candidate not found.",
  invalid_evidence_type: "That is not a recognized evidence type.",
  invalid_rating: "That is not a recognized rating.",
  missing_summary: "An evaluator summary is required.",
  closed: "This candidacy is closed. New evidence cannot be recorded through this form.",
  insert_failed: "Could not record this evidence. Please try again.",
};

// Exactly the three source-grounded certification decision outcomes
// (Instrument 11 / Evaluator Handbook §20 / Candidate Pathway §11 / Program
// Operations Form 9) -- never change without a schema change.
const DECISIONS = ["certified", "development_required", "not_currently_eligible"] as const;
type Decision = (typeof DECISIONS)[number];

const DECISION_LABEL: Record<Decision, string> = {
  certified: "Certified",
  development_required: "Development Required",
  not_currently_eligible: "Not Currently Eligible",
};

const YES_NO_LABEL: Record<"true" | "false", string> = {
  true: "Yes",
  false: "No",
};

const DECISION_ERROR_MESSAGE: Record<string, string> = {
  missing_candidate: "Candidate not found.",
  closed: "This candidacy is closed. New certification decisions cannot be recorded through this form.",
  invalid_decision: "That is not a recognized certification decision.",
  invalid_decision_date: "A valid decision date is required.",
  invalid_evidence_complete: "Please indicate whether all required evidence is complete.",
  invalid_critical_fail_clear: "Please indicate whether all Critical Fail gates are clear.",
  missing_rationale: "A decision rationale is required.",
  missing_evaluator_email: "An evaluator email is required.",
  evaluator_not_found: "Evaluator must have an existing AVAIA account.",
  insert_failed: "Could not record this certification decision. Please try again.",
};

/** Formats a Date as a datetime-local input value ("YYYY-MM-DDTHH:mm") for
 *  the Decision Date field's default -- local to wherever this renders,
 *  which is acceptable for a default the admin can freely change; nothing
 *  here builds timezone infrastructure. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Changes a candidate's lifecycle status and records exactly one
 *  guide_candidate_history row describing the transition -- guide_candidates
 *  holds current state, guide_candidate_history holds what happened over
 *  time, per the approved Phase C.3 architecture. Re-reads the current
 *  status fresh (never trusts a hidden form field for it), refuses any
 *  change once the candidacy is already closed, refuses a submission that
 *  doesn't actually change the status (no fake history rows), and guards
 *  the update itself with .eq("status", currentStatus) so a concurrent
 *  change from another admin can't be silently overwritten -- if the
 *  guarded update affects no rows, that's reported as a conflict instead of
 *  applied blindly. Uses the signed-in admin's own RLS-bound client
 *  throughout; createAdminClient() is never involved in this action. */
async function updateCandidateStatus(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-candidates");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const candidateId = String(formData.get("candidateId") ?? "");
  const newStatus = String(formData.get("status") ?? "") as CandidateStatus;
  const note = String(formData.get("note") ?? "").trim();
  if (!candidateId) redirect("/admin/guide-candidates");
  if (!VALID_STATUSES.includes(newStatus)) {
    redirect(`/admin/guide-candidates/${candidateId}?statusError=invalid_status`);
  }

  const { data: current } = await supabase
    .from("guide_candidates")
    .select("status")
    .eq("id", candidateId)
    .maybeSingle();
  if (!current) {
    redirect(`/admin/guide-candidates/${candidateId}?statusError=not_found`);
  }

  const currentStatus = current.status as CandidateStatus;
  if (CLOSED_STATUSES.includes(currentStatus)) {
    redirect(`/admin/guide-candidates/${candidateId}?statusError=closed`);
  }
  if (newStatus === currentStatus) {
    redirect(`/admin/guide-candidates/${candidateId}?statusError=no_change`);
  }

  const { data: updated, error } = await supabase
    .from("guide_candidates")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", candidateId)
    .eq("status", currentStatus)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    redirect(`/admin/guide-candidates/${candidateId}?statusError=conflict`);
  }

  const body = `Status changed from ${currentStatus.replace(/_/g, " ")} to ${newStatus.replace(/_/g, " ")}.${note ? `\n\n${note}` : ""}`;
  await supabase.from("guide_candidate_history").insert({
    candidate_id: candidateId,
    entry_type: "status_change",
    body,
    recorded_by: user.id,
  });

  redirect(`/admin/guide-candidates/${candidateId}?statusUpdated=1`);
}

/** Records one guide_candidate_evidence row (Phase C.5) -- a structured
 *  fact about what the candidate demonstrated and what a human evaluator
 *  found, per the approved Phase C.4 evidence architecture. Evidence is
 *  append-only: multiple rows of the same evidence_type are intentional
 *  (reassessment), so this never updates or deduplicates an existing row.
 *  Recording evidence has no automatic consequence -- it never touches
 *  guide_candidates.status or guide_certifications; whether/how a finding
 *  should affect the candidacy remains a separate, later, human decision
 *  through the existing Manage Candidacy Status control. Refuses new
 *  evidence once the candidacy is closed (withdrawn/not_certified), same
 *  terminal-state posture as updateCandidateStatus above. Uses the
 *  signed-in admin's own RLS-bound client throughout; createAdminClient()
 *  is never involved in this action. */
async function recordEvidence(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-candidates");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const candidateId = String(formData.get("candidateId") ?? "");
  const evidenceType = String(formData.get("evidenceType") ?? "") as EvidenceType;
  const rating = String(formData.get("rating") ?? "") as EvidenceRating;
  const summary = String(formData.get("summary") ?? "").trim();

  if (!candidateId) redirect("/admin/guide-candidates");
  if (!EVIDENCE_TYPES.includes(evidenceType)) {
    redirect(`/admin/guide-candidates/${candidateId}?evidenceError=invalid_evidence_type`);
  }
  if (!RATINGS.includes(rating)) {
    redirect(`/admin/guide-candidates/${candidateId}?evidenceError=invalid_rating`);
  }
  if (!summary) {
    redirect(`/admin/guide-candidates/${candidateId}?evidenceError=missing_summary`);
  }

  const { data: current } = await supabase
    .from("guide_candidates")
    .select("status")
    .eq("id", candidateId)
    .maybeSingle();
  if (!current) {
    redirect(`/admin/guide-candidates/${candidateId}?evidenceError=missing_candidate`);
  }
  if (CLOSED_STATUSES.includes(current.status as CandidateStatus)) {
    redirect(`/admin/guide-candidates/${candidateId}?evidenceError=closed`);
  }

  const { error } = await supabase.from("guide_candidate_evidence").insert({
    candidate_id: candidateId,
    evidence_type: evidenceType,
    rating,
    summary,
    recorded_by: user.id,
  });
  if (error) {
    redirect(`/admin/guide-candidates/${candidateId}?evidenceError=insert_failed`);
  }

  redirect(`/admin/guide-candidates/${candidateId}?evidenceRecorded=1`);
}

/** Same page-through-listUsers exact-match pattern already used for
 *  Candidate Admission (app/admin/guide-candidates/page.tsx) and Guide
 *  Toolkit participants -- copied fresh here (not imported) so those
 *  existing, working flows stay untouched. Resolves the Evaluator field to
 *  an existing AVAIA account; the evaluator does NOT need to be an admin
 *  or a Guide -- this is attribution only, no evaluator authorization or
 *  role exists yet. */
async function findHostIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

/** Records one guide_certification_decisions row (Phase C.8) -- the
 *  institutional record of what AVAIA decided at a certification review,
 *  per the approved Phase C.7A/C.7B architecture. This is a completed
 *  review conference, not a workflow: evaluated_at/authorized_at both use
 *  the database's own now() default, and authorized_by is always the
 *  signed-in admin recording this -- manual authorizer selection is not
 *  built. The evaluator field is attribution only (may be any existing
 *  AVAIA account, resolved the same way Candidate Admission resolves an
 *  email); it does not require or imply any role, permission, or
 *  authorization. Recording a decision here does NOT write
 *  guide_candidate_history, does NOT update guide_candidates.status, and
 *  does NOT create or modify guide_certifications -- those remain entirely
 *  separate, later, human actions. Refuses new decisions once the
 *  candidacy is closed, same terminal-state posture as the other actions
 *  on this page. Uses the signed-in admin's own RLS-bound client for the
 *  insert; createAdminClient() is used only to resolve the evaluator's
 *  email to an account id. */
async function recordCertificationDecision(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-candidates");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const candidateId = String(formData.get("candidateId") ?? "");
  const decision = String(formData.get("decision") ?? "") as Decision;
  const decisionDateRaw = String(formData.get("decisionDate") ?? "");
  const evidenceCompleteRaw = String(formData.get("evidenceComplete") ?? "");
  const criticalFailClearRaw = String(formData.get("criticalFailClear") ?? "");
  const decisionRationale = String(formData.get("decisionRationale") ?? "").trim();
  const continuingDevelopmentNotes = String(formData.get("continuingDevelopmentNotes") ?? "").trim();
  const curriculumVersion = String(formData.get("curriculumVersion") ?? "").trim();
  const guideManualVersion = String(formData.get("guideManualVersion") ?? "").trim();
  const assessmentPacketVersion = String(formData.get("assessmentPacketVersion") ?? "").trim();
  const evaluatorEmail = String(formData.get("evaluatorEmail") ?? "").trim().toLowerCase();

  if (!candidateId) redirect("/admin/guide-candidates");
  if (!DECISIONS.includes(decision)) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=invalid_decision`);
  }

  const decisionDate = decisionDateRaw ? new Date(decisionDateRaw) : null;
  if (!decisionDate || Number.isNaN(decisionDate.getTime())) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=invalid_decision_date`);
  }

  if (evidenceCompleteRaw !== "yes" && evidenceCompleteRaw !== "no") {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=invalid_evidence_complete`);
  }
  if (criticalFailClearRaw !== "yes" && criticalFailClearRaw !== "no") {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=invalid_critical_fail_clear`);
  }
  if (!decisionRationale) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=missing_rationale`);
  }
  if (!evaluatorEmail) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=missing_evaluator_email`);
  }

  const { data: current } = await supabase
    .from("guide_candidates")
    .select("host_id, status")
    .eq("id", candidateId)
    .maybeSingle();
  if (!current) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=missing_candidate`);
  }
  if (CLOSED_STATUSES.includes(current.status as CandidateStatus)) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=closed`);
  }

  const evaluatorId = await findHostIdByEmail(evaluatorEmail);
  if (!evaluatorId) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=evaluator_not_found`);
  }

  const { error } = await supabase.from("guide_certification_decisions").insert({
    candidate_id: candidateId,
    host_id: current.host_id,
    decision,
    decision_date: decisionDate.toISOString(),
    decision_rationale: decisionRationale,
    continuing_development_notes: continuingDevelopmentNotes || null,
    evidence_complete_attested: evidenceCompleteRaw === "yes",
    critical_fail_gates_clear_attested: criticalFailClearRaw === "yes",
    curriculum_version: curriculumVersion || null,
    guide_manual_version: guideManualVersion || null,
    assessment_packet_version: assessmentPacketVersion || null,
    evaluated_by: evaluatorId,
    authorized_by: user.id,
  });
  if (error) {
    redirect(`/admin/guide-candidates/${candidateId}?decisionError=insert_failed`);
  }

  redirect(`/admin/guide-candidates/${candidateId}?decisionRecorded=1`);
}

/** Candidacy record + lifecycle status control (Phase C.3) + certification
 *  evidence recording (Phase C.5) + certification decision recording
 *  (Phase C.8). Still no Grant Certification here -- guide_certifications
 *  remains a later, separately-approved phase. */
export default async function AdminGuideCandidateDetailPage({
  params,
  searchParams,
}: {
  params: { candidateId: string };
  searchParams: {
    admitted?: string;
    statusUpdated?: string;
    statusError?: string;
    evidenceRecorded?: string;
    evidenceError?: string;
    decisionRecorded?: string;
    decisionError?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-candidates");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  const { data: candidate } = await supabase
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at, admitted_by, notes, created_at, updated_at")
    .eq("id", params.candidateId)
    .maybeSingle();
  if (!candidate) notFound();

  const { data: historyRows } = await supabase
    .from("guide_candidate_history")
    .select("id, entry_type, body, recorded_by, recorded_at")
    .eq("candidate_id", candidate.id)
    .order("recorded_at", { ascending: true });
  const history = historyRows ?? [];
  const isClosed = CLOSED_STATUSES.includes(candidate.status as CandidateStatus);

  const { data: evidenceRows } = await supabase
    .from("guide_candidate_evidence")
    .select("id, evidence_type, rating, summary, recorded_by, recorded_at")
    .eq("candidate_id", candidate.id)
    .order("recorded_at", { ascending: false });
  const evidence = evidenceRows ?? [];

  // Evidence Review (Phase C.6): the latest recorded finding per evidence
  // type, derived in application code from the rows already fetched above
  // -- no view, no SQL function, no schema change. `evidence` is already
  // ordered newest-first (see the query above), so the first row seen for
  // a given evidence_type here IS its latest finding; every row after that
  // for the same type is earlier history and is skipped for this map only
  // -- nothing is mutated, deleted, or hidden from the Evidence Records
  // list below, which still shows every row.
  const latestByType = new Map<EvidenceType, (typeof evidence)[number]>();
  for (const e of evidence) {
    const type = e.evidence_type as EvidenceType;
    if (!latestByType.has(type)) latestByType.set(type, e);
  }

  const { data: decisionRows } = await supabase
    .from("guide_certification_decisions")
    .select(
      "id, decision, decision_date, decision_rationale, continuing_development_notes, evidence_complete_attested, critical_fail_gates_clear_attested, curriculum_version, guide_manual_version, assessment_packet_version, evaluated_by, evaluated_at, authorized_by, authorized_at"
    )
    .eq("candidate_id", candidate.id)
    .order("decision_date", { ascending: false });
  const decisions = decisionRows ?? [];

  // Identity resolution only -- account email, admitting admin's email,
  // each history entry's recorder's email, each evidence row's recorder's
  // email, and each decision's evaluator/authorizer email. Never used to
  // read or write guide_candidates/guide_candidate_history/
  // guide_candidate_evidence/guide_certification_decisions themselves
  // (those already came from the signed-in admin's own RLS-bound client
  // above).
  const admin = createAdminClient();
  const idsToResolve = new Set<string>([candidate.host_id]);
  if (candidate.admitted_by) idsToResolve.add(candidate.admitted_by);
  for (const h of history) if (h.recorded_by) idsToResolve.add(h.recorded_by);
  for (const e of evidence) if (e.recorded_by) idsToResolve.add(e.recorded_by);
  for (const d of decisions) {
    if (d.evaluated_by) idsToResolve.add(d.evaluated_by);
    if (d.authorized_by) idsToResolve.add(d.authorized_by);
  }
  const emailById = new Map<string, string>();
  await Promise.all(
    Array.from(idsToResolve).map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) emailById.set(id, data.user.email);
    })
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <Link href="/admin/guide-candidates" className="label text-muted hover:text-seal">
        &larr; Certified Guide Candidates
      </Link>

      {searchParams?.admitted === "1" && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Candidate admitted.
        </p>
      )}

      {searchParams?.statusUpdated === "1" && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Status updated.
        </p>
      )}

      {searchParams?.statusError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {STATUS_ERROR_MESSAGE[searchParams.statusError] ?? "Something went wrong."}
        </p>
      )}

      {searchParams?.evidenceRecorded === "1" && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Evidence recorded.
        </p>
      )}

      {searchParams?.evidenceError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {EVIDENCE_ERROR_MESSAGE[searchParams.evidenceError] ?? "Something went wrong."}
        </p>
      )}

      {searchParams?.decisionRecorded === "1" && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Certification decision recorded.
        </p>
      )}

      {searchParams?.decisionError && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {DECISION_ERROR_MESSAGE[searchParams.decisionError] ?? "Something went wrong."}
        </p>
      )}

      <p className="label mb-3 mt-6">Guide Candidate</p>
      <h1 className="font-serif text-4xl text-ink">
        {emailById.get(candidate.host_id) ?? "Unknown account"}
      </h1>

      <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="label text-muted">Status</dt>
            <dd className="mt-1 text-ink">{candidate.status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="label text-muted">Admitted</dt>
            <dd className="mt-1 text-ink">{new Date(candidate.admitted_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="label text-muted">Admitted By</dt>
            <dd className="mt-1 text-ink">
              {candidate.admitted_by ? emailById.get(candidate.admitted_by) ?? "Unknown" : "—"}
            </dd>
          </div>
          <div>
            <dt className="label text-muted">Last Updated</dt>
            <dd className="mt-1 text-ink">{new Date(candidate.updated_at).toLocaleString()}</dd>
          </div>
        </dl>
        {candidate.notes && (
          <div className="mt-4 border-t border-rule pt-4">
            <p className="label text-muted">Notes</p>
            <p className="mt-1 text-ink">{candidate.notes}</p>
          </div>
        )}
      </div>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Manage Candidacy Status</p>
        {isClosed ? (
          <p className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3 text-muted">
            This candidacy is closed ({candidate.status.replace(/_/g, " ")}). Reopening is not
            available in this phase.
          </p>
        ) : (
          <form
            action={updateCandidateStatus}
            className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
          >
            <input type="hidden" name="candidateId" value={candidate.id} />
            <p className="text-ink">
              Current status: <span className="text-seal">{candidate.status.replace(/_/g, " ")}</span>
            </p>
            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="status">
                Change status to
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue=""
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" disabled className="bg-[#05060b] text-ink">
                  Select a status
                </option>
                {VALID_STATUSES.filter((s) => s !== candidate.status).map((s) => (
                  <option key={s} value={s} className="bg-[#05060b] text-ink">
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="note">
                Institutional note (optional)
              </label>
              <textarea
                id="note"
                name="note"
                rows={3}
                className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                placeholder="Why this change is being made, if worth recording."
              />
            </div>
            <button
              type="submit"
              className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Update Status
            </button>
          </form>
        )}
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Certification Evidence</p>

        {/* Evidence Review -- current/latest finding per required evidence
            type, always all 12, review only. Deliberately no readiness
            calculation, no percentage, no pass/fail language -- just the
            most recent human finding, or that none exists yet. */}
        <div className="mb-8">
          <p className="label mb-3 text-muted">Evidence Review</p>
          <div className="rounded-lg border border-rule bg-white/[0.04] px-4">
            {EVIDENCE_TYPES.map((t) => {
              const latest = latestByType.get(t);
              return (
                <div
                  key={t}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-rule/60 py-3 last:border-b-0"
                >
                  <span className="text-ink">{EVIDENCE_TYPE_LABEL[t]}</span>
                  {latest ? (
                    <span className="text-right text-sm">
                      <span className="text-seal">{RATING_LABEL[latest.rating as EvidenceRating]}</span>
                      <span className="ml-2 text-xs text-muted">
                        {new Date(latest.recorded_at).toLocaleDateString()}
                        {latest.recorded_by ? ` · ${emailById.get(latest.recorded_by) ?? "Unknown"}` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted">No Evidence Yet</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p className="label mb-3 text-muted">Evidence Records</p>
        {evidence.length === 0 ? (
          <p className="text-muted">No evidence recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {evidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">
                    {EVIDENCE_TYPE_LABEL[e.evidence_type as EvidenceType] ?? e.evidence_type}
                  </span>
                  <span className="label text-seal">
                    {RATING_LABEL[e.rating as EvidenceRating] ?? e.rating}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-ink">{e.summary}</p>
                <p className="mt-2 text-xs text-muted">
                  {new Date(e.recorded_at).toLocaleString()}
                  {e.recorded_by ? ` · ${emailById.get(e.recorded_by) ?? "Unknown"}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {isClosed ? (
          <p className="mt-6 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 text-muted">
            This candidacy is closed. New evidence cannot be recorded through this form.
          </p>
        ) : (
          <form
            action={recordEvidence}
            className="mt-6 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
          >
            <input type="hidden" name="candidateId" value={candidate.id} />
            <p className="label mb-3 text-muted">Record Evidence</p>
            <div>
              <label className="label mb-2 block" htmlFor="evidenceType">
                Evidence Type
              </label>
              <select
                id="evidenceType"
                name="evidenceType"
                required
                defaultValue=""
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" disabled className="bg-[#05060b] text-ink">
                  Select an evidence type
                </option>
                {EVIDENCE_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#05060b] text-ink">
                    {EVIDENCE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="rating">
                Rating
              </label>
              <select
                id="rating"
                name="rating"
                required
                defaultValue=""
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" disabled className="bg-[#05060b] text-ink">
                  Select a rating
                </option>
                {RATINGS.map((r) => (
                  <option key={r} value={r} className="bg-[#05060b] text-ink">
                    {RATING_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="summary">
                Evaluator Summary
              </label>
              <p className="mb-2 text-xs text-muted">
                Describe the candidate&rsquo;s demonstrated stewardship. Do not include private Host
                conversation content.
              </p>
              <textarea
                id="summary"
                name="summary"
                required
                rows={4}
                className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>
            <button
              type="submit"
              className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Record Evidence
            </button>
          </form>
        )}
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Certification Decisions</p>
        <p className="mb-3 text-sm text-muted">
          Certification Decision History — these are append-only institutional records. Prior
          decisions are never edited or overwritten.
        </p>

        {decisions.length === 0 ? (
          <p className="text-muted">No certification decisions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">{DECISION_LABEL[d.decision as Decision] ?? d.decision}</span>
                  <span className="text-xs text-muted">{new Date(d.decision_date).toLocaleString()}</span>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="label text-muted">Evidence Complete</dt>
                    <dd className="mt-1 text-ink">
                      {YES_NO_LABEL[String(d.evidence_complete_attested) as "true" | "false"]}
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-muted">Critical Fail Gates Clear</dt>
                    <dd className="mt-1 text-ink">
                      {YES_NO_LABEL[String(d.critical_fail_gates_clear_attested) as "true" | "false"]}
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-muted">Evaluator</dt>
                    <dd className="mt-1 text-ink">
                      {d.evaluated_by ? emailById.get(d.evaluated_by) ?? "Unknown" : "—"}
                      <span className="ml-2 text-xs text-muted">
                        {new Date(d.evaluated_at).toLocaleString()}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-muted">AVAIA Authorization</dt>
                    <dd className="mt-1 text-ink">
                      {d.authorized_by ? emailById.get(d.authorized_by) ?? "Unknown" : "—"}
                      <span className="ml-2 text-xs text-muted">
                        {new Date(d.authorized_at).toLocaleString()}
                      </span>
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-rule pt-3">
                  <p className="label text-muted">Decision Rationale</p>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{d.decision_rationale}</p>
                </div>
                {d.continuing_development_notes && (
                  <div className="mt-3 border-t border-rule pt-3">
                    <p className="label text-muted">Continuing Development Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-ink">{d.continuing_development_notes}</p>
                  </div>
                )}
                {(d.curriculum_version || d.guide_manual_version || d.assessment_packet_version) && (
                  <div className="mt-3 border-t border-rule pt-3 text-xs text-muted">
                    {d.curriculum_version && <span className="mr-4">Curriculum: {d.curriculum_version}</span>}
                    {d.guide_manual_version && (
                      <span className="mr-4">Guide Manual: {d.guide_manual_version}</span>
                    )}
                    {d.assessment_packet_version && (
                      <span>Assessment Packet: {d.assessment_packet_version}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {isClosed ? (
          <p className="mt-6 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 text-muted">
            This candidacy is closed. New certification decisions cannot be recorded through this
            form.
          </p>
        ) : (
          <form
            action={recordCertificationDecision}
            className="mt-6 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
          >
            <input type="hidden" name="candidateId" value={candidate.id} />
            <p className="label mb-3 text-muted">Record Certification Decision</p>

            <div>
              <label className="label mb-2 block" htmlFor="decision">
                Decision
              </label>
              <select
                id="decision"
                name="decision"
                required
                defaultValue=""
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              >
                <option value="" disabled className="bg-[#05060b] text-ink">
                  Select a decision
                </option>
                {DECISIONS.map((d) => (
                  <option key={d} value={d} className="bg-[#05060b] text-ink">
                    {DECISION_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="decisionDate">
                Decision Date
              </label>
              <input
                id="decisionDate"
                name="decisionDate"
                type="datetime-local"
                required
                defaultValue={toDatetimeLocalValue(new Date())}
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label mb-2 block" htmlFor="evidenceComplete">
                  All required evidence complete?
                </label>
                <select
                  id="evidenceComplete"
                  name="evidenceComplete"
                  required
                  defaultValue=""
                  className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                >
                  <option value="" disabled className="bg-[#05060b] text-ink">
                    Select
                  </option>
                  <option value="yes" className="bg-[#05060b] text-ink">
                    Yes
                  </option>
                  <option value="no" className="bg-[#05060b] text-ink">
                    No
                  </option>
                </select>
              </div>
              <div>
                <label className="label mb-2 block" htmlFor="criticalFailClear">
                  All Critical Fail gates clear?
                </label>
                <select
                  id="criticalFailClear"
                  name="criticalFailClear"
                  required
                  defaultValue=""
                  className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                >
                  <option value="" disabled className="bg-[#05060b] text-ink">
                    Select
                  </option>
                  <option value="yes" className="bg-[#05060b] text-ink">
                    Yes
                  </option>
                  <option value="no" className="bg-[#05060b] text-ink">
                    No
                  </option>
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              These are the human/institutional attestations made at this review — not calculated
              by AVAIA.
            </p>

            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="decisionRationale">
                Decision Rationale
              </label>
              <p className="mb-2 text-xs text-muted">
                Record the certification judgment and demonstrated stewardship. Do not include
                private Host conversation content.
              </p>
              <textarea
                id="decisionRationale"
                name="decisionRationale"
                required
                rows={4}
                className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>

            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="continuingDevelopmentNotes">
                Continuing Development Notes (optional)
              </label>
              <textarea
                id="continuingDevelopmentNotes"
                name="continuingDevelopmentNotes"
                rows={3}
                className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                placeholder="Especially useful when the decision is Development Required or Not Currently Eligible."
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label mb-2 block" htmlFor="curriculumVersion">
                  Curriculum Version (optional)
                </label>
                <input
                  id="curriculumVersion"
                  name="curriculumVersion"
                  type="text"
                  className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                />
              </div>
              <div>
                <label className="label mb-2 block" htmlFor="guideManualVersion">
                  Guide Manual Version (optional)
                </label>
                <input
                  id="guideManualVersion"
                  name="guideManualVersion"
                  type="text"
                  className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                />
              </div>
              <div>
                <label className="label mb-2 block" htmlFor="assessmentPacketVersion">
                  Assessment Packet Version (optional)
                </label>
                <input
                  id="assessmentPacketVersion"
                  name="assessmentPacketVersion"
                  type="text"
                  className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="label mb-2 block" htmlFor="evaluatorEmail">
                Evaluator Email
              </label>
              <p className="mb-2 text-xs text-muted">
                Must be an existing AVAIA account. Defaults to you, but may be a different account
                that performed the evaluation. Attribution only — no evaluator role or
                authorization is required or implied.
              </p>
              <input
                id="evaluatorEmail"
                name="evaluatorEmail"
                type="email"
                required
                defaultValue={user.email ?? ""}
                className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              />
            </div>

            <p className="mt-4 text-xs text-muted">
              AVAIA authorization for this record will be attributed to you ({user.email ?? "your account"}
              ) at the time of submission.
            </p>

            <button
              type="submit"
              className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Record Certification Decision
            </button>
          </form>
        )}
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Institutional History</p>
        {history.length === 0 ? (
          <p className="text-muted">No history recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-lg border border-rule bg-white/[0.04] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="label text-seal">
                    {HISTORY_ENTRY_LABEL[h.entry_type] ?? h.entry_type}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(h.recorded_at).toLocaleString()}
                    {h.recorded_by ? ` · ${emailById.get(h.recorded_by) ?? "Unknown"}` : ""}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-ink">{h.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
