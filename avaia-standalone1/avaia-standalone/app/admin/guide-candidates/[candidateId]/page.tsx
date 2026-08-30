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

/** Read-only candidacy record (Phase C.2). Deliberately no lifecycle/status
 *  controls and no certification-granting controls here -- those are later,
 *  separately-approved phases; this page only shows what admitCandidate()
 *  in the parent page already recorded. */
export default async function AdminGuideCandidateDetailPage({
  params,
  searchParams,
}: {
  params: { candidateId: string };
  searchParams: { admitted?: string };
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

  // Identity resolution only -- account email, admitting admin's email, and
  // each history entry's recorder's email. Never used to read or write
  // guide_candidates/guide_candidate_history themselves (those already came
  // from the signed-in admin's own RLS-bound client above).
  const admin = createAdminClient();
  const idsToResolve = new Set<string>([candidate.host_id]);
  if (candidate.admitted_by) idsToResolve.add(candidate.admitted_by);
  for (const h of history) if (h.recorded_by) idsToResolve.add(h.recorded_by);
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
                <p className="mt-2 text-ink">{h.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
