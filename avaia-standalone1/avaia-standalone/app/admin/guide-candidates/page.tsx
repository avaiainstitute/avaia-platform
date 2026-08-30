import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Certified Guide Candidates — AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Certified AVAIA Guide candidate administration (Phase C.2). Admits an
 *  existing AVAIA account into the candidacy pathway and lists current
 *  candidates. Deliberately does NOT read contact_submissions -- interest
 *  and candidacy remain separate; an admin admits someone here as an
 *  intentional decision, never automatically from a contact form
 *  submission. Not linked from the global Nav, reachable only by URL --
 *  same posture as /admin/experiences and /toolkit before they were
 *  advertised. */

const ERROR_MESSAGE: Record<string, string> = {
  missing_email: "An email address is required.",
  no_account: "No AVAIA account exists for that email yet. The person must sign up first.",
  open_candidacy_exists: "This person already has an open candidacy.",
  admit_failed: "Could not admit this candidate. Please try again.",
};

/** Same page-through-listUsers pattern already used in app/api/share/route.ts
 *  and app/toolkit/page.tsx -- copied fresh here (not imported) so those
 *  existing, working flows stay untouched. auth.users has no server-side
 *  email filter, so this pages through comparing emails directly. */
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

/** Resolves guide_candidates.host_id -> email for display only, the same
 *  bulk-resolution pattern already used for shared_access recipients in
 *  app/workbook/page.tsx. createAdminClient() is used ONLY for this identity
 *  lookup -- never for reading or writing guide_candidates/
 *  guide_candidate_history, which always go through the signed-in admin's
 *  own RLS-bound client below. */
async function resolveEmailsByHostId(hostIds: string[]): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  if (hostIds.length === 0) return emailById;
  const admin = createAdminClient();
  const remaining = new Set(hostIds);
  for (let page = 1; page <= 20 && remaining.size > 0; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data || data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email && remaining.has(u.id)) {
        emailById.set(u.id, u.email);
        remaining.delete(u.id);
      }
    }
    if (data.users.length < 1000) break;
  }
  return emailById;
}

/** Admits an existing AVAIA account as a certification candidate. Requires
 *  only an email -- guide_candidates has no name column, so there is
 *  nothing else to require. Creates exactly one guide_candidates row and one
 *  guide_candidate_history row (the admission note if given, otherwise a
 *  default description -- never both, so nothing is duplicated). Both
 *  inserts run through the signed-in admin's own RLS-bound client: the
 *  database's existing "admin all" policies (added in 0022) are the real
 *  enforcement, not this action's own role check alone -- but the check is
 *  still required here, since a Server Action is its own reachable endpoint,
 *  not something only rendered inside this gated page. */
async function admitCandidate(formData: FormData) {
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

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!email || !email.includes("@")) {
    redirect("/admin/guide-candidates?error=missing_email");
  }

  const hostId = await findHostIdByEmail(email);
  if (!hostId) {
    redirect("/admin/guide-candidates?error=no_account");
  }

  const { data: candidate, error } = await supabase
    .from("guide_candidates")
    .insert({
      host_id: hostId,
      admitted_by: user.id,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error || !candidate) {
    if (error?.code === "23505") {
      redirect("/admin/guide-candidates?error=open_candidacy_exists");
    }
    redirect("/admin/guide-candidates?error=admit_failed");
  }

  await supabase.from("guide_candidate_history").insert({
    candidate_id: candidate.id,
    entry_type: "status_change",
    body: notes || "Admitted as a certification candidate.",
    recorded_by: user.id,
  });

  redirect(`/admin/guide-candidates/${candidate.id}?admitted=1`);
}

export default async function AdminGuideCandidatesPage({
  searchParams,
}: {
  searchParams: { error?: string };
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

  const { data: candidateRows } = await supabase
    .from("guide_candidates")
    .select("id, host_id, status, admitted_at")
    .order("admitted_at", { ascending: false });
  const candidates = candidateRows ?? [];

  const emailByHostId = await resolveEmailsByHostId(candidates.map((c) => c.host_id));

  const errorParam = searchParams?.error;
  const errorMessage = errorParam ? ERROR_MESSAGE[errorParam] ?? "Something went wrong." : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Certified Guide Candidates</h1>
      <p className="mt-4 text-lg text-muted">
        Admitting a candidate here is an intentional AVAIA decision, separate from a Certification
        contact submission. The person must already have an AVAIA account.
      </p>

      {errorMessage && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {errorMessage}
        </p>
      )}

      {/* Admit a candidate */}
      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Admit a Candidate</p>
        <form
          action={admitCandidate}
          className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
        >
          <div>
            <label className="label mb-2 block" htmlFor="email">
              AVAIA account email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div className="mt-4">
            <label className="label mb-2 block" htmlFor="notes">
              Institutional note (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
              placeholder="Why this person is being admitted, or anything worth recording at admission."
            />
          </div>
          <button
            type="submit"
            className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Admit Candidate
          </button>
        </form>
      </section>

      {/* Existing candidates */}
      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Candidates</p>
        {candidates.length === 0 ? (
          <p className="text-muted">No candidates admitted yet.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <Link
                key={c.id}
                href={`/admin/guide-candidates/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] px-4 py-3 transition-colors hover:border-seal"
              >
                <div>
                  <p className="text-ink">{emailByHostId.get(c.host_id) ?? "Unknown account"}</p>
                  <p className="text-xs text-muted">
                    Admitted {new Date(c.admitted_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="label text-seal">{c.status.replace(/_/g, " ")}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
