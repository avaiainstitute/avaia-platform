import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Coordination support, AVAIA" };
export const dynamic = "force-dynamic";

// COORDINATION SUPPORT AUTHORIZATION (Phase 4, Decision 0011). An independent Guide capability, granted or
// ended by an administrator, one explicit institutional act each. It authorizes this Guide to be CHOSEN by a
// Host for coordination support. By itself it gives access to nothing: a Host must separately give an
// explicit, time-limited grant, and the database re-checks certification, this capability and that grant on
// every read. It is never given to ordinary Certified Guides by default, and it is not Journey facilitation.
// Defines no curriculum, pricing, CE or admission standard. Uses the signed-in admin's own RLS-bound client.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/guide-candidates");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return { supabase, userId: user.id };
}

/** The Guide's account and current certification, derived fresh from the records (never from role or status). */
async function loadGuide(supabase: ReturnType<typeof createClient>, candidateId: string) {
  const { data: candidate } = await supabase.from("guide_candidates").select("id, host_id").eq("id", candidateId).maybeSingle();
  if (!candidate) return null;
  const { data: certification } = await supabase
    .from("guide_certifications")
    .select("host_id, standing")
    .eq("host_id", candidate.host_id)
    .maybeSingle();
  return { candidate, certification };
}

async function grantAction(formData: FormData) {
  "use server";
  const { supabase, userId } = await requireAdmin();
  const candidateId = String(formData.get("candidateId") ?? "");
  const here = `/admin/guide-candidates/${candidateId}/coordination-support`;
  if (formData.get("confirmAuthorization") !== "on") redirect(`${here}?error=${encodeURIComponent("Tick the box to confirm.")}`);
  const guide = await loadGuide(supabase, candidateId);
  if (!guide) redirect(`${here}?error=${encodeURIComponent("That candidate could not be found.")}`);
  if (!guide.certification || guide.certification.standing !== "active") {
    redirect(`${here}?error=${encodeURIComponent("This Guide does not currently hold an active certification.")}`);
  }
  const { data: existing } = await supabase
    .from("guide_platform_authorizations")
    .select("id")
    .eq("host_id", guide.certification.host_id)
    .eq("capability", "coordination_support")
    .eq("status", "authorized")
    .maybeSingle();
  if (existing) redirect(`${here}?error=${encodeURIComponent("This Guide is already authorized.")}`);
  const { error } = await supabase.from("guide_platform_authorizations").insert({
    host_id: guide.certification.host_id,
    capability: "coordination_support",
    granted_by: userId,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  if (error) redirect(`${here}?error=${encodeURIComponent("That could not be saved. Please try again.")}`);
  redirect(`${here}?saved=${encodeURIComponent("Coordination support authorized.")}`);
}

async function revokeAction(formData: FormData) {
  "use server";
  const { supabase, userId } = await requireAdmin();
  const candidateId = String(formData.get("candidateId") ?? "");
  const here = `/admin/guide-candidates/${candidateId}/coordination-support`;
  if (formData.get("confirmRevoke") !== "on") redirect(`${here}?error=${encodeURIComponent("Tick the box to confirm.")}`);
  const guide = await loadGuide(supabase, candidateId);
  if (!guide) redirect(`${here}?error=${encodeURIComponent("That candidate could not be found.")}`);
  const { data, error } = await supabase
    .from("guide_platform_authorizations")
    .update({ status: "revoked", status_changed_by: userId, status_changed_at: new Date().toISOString() })
    .eq("host_id", guide.candidate.host_id)
    .eq("capability", "coordination_support")
    .eq("status", "authorized")
    .select("id");
  if (error || !data || data.length === 0) redirect(`${here}?error=${encodeURIComponent("There was nothing to end, or it could not be saved.")}`);
  redirect(`${here}?saved=${encodeURIComponent("Coordination support ended. Any access a Host gave this Guide stops at once.")}`);
}

export default async function CoordinationSupportAdminPage({
  params,
  searchParams,
}: {
  params: { candidateId: string };
  searchParams: { saved?: string; error?: string };
}) {
  const { supabase } = await requireAdmin();
  const guide = await loadGuide(supabase, params.candidateId);
  if (!guide) notFound();

  const { data: authorization } = await supabase
    .from("guide_platform_authorizations")
    .select("id, granted_at, notes")
    .eq("host_id", guide.candidate.host_id)
    .eq("capability", "coordination_support")
    .eq("status", "authorized")
    .maybeSingle();
  const certified = guide.certification?.standing === "active";

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="mb-6">
        <Link href={`/admin/guide-candidates/${params.candidateId}`} className="label hover:text-seal">
          ← Back to this candidate
        </Link>
      </p>
      <p className="label mb-3">Guide capability</p>
      <h1 className="font-serif text-4xl text-ink">Coordination support</h1>
      <p className="mt-4 text-muted">
        This authorizes the Guide to be chosen by a Host for coordination support. It gives access to nothing by itself: a Host must separately give an
        explicit, time-limited grant, and the database re-checks certification, this authorization and that grant on every read. It is not Guided Journey
        facilitation and is never given to Certified Guides by default.
      </p>

      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>}
      {searchParams.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>
      )}

      {authorization ? (
        <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
          <p className="text-ink">Authorized</p>
          <p className="mt-1 text-sm text-muted">Granted {new Date(authorization.granted_at).toLocaleString()}</p>
          {authorization.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{authorization.notes}</p>}
          <form action={revokeAction} className="mt-5 border-t border-rule pt-5">
            <input type="hidden" name="candidateId" value={params.candidateId} />
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" name="confirmRevoke" className="mt-1" required />
              <span className="text-ink">I confirm AVAIA is ending this Guide&rsquo;s coordination support authorization.</span>
            </label>
            <button type="submit" className="mt-4 rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal">
              End authorization
            </button>
          </form>
        </div>
      ) : certified ? (
        <form action={grantAction} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5">
          <input type="hidden" name="candidateId" value={params.candidateId} />
          <p className="text-ink">Coordination support: Not authorized</p>
          <label className="label mb-2 mt-4 block" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full resize-none rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none focus:border-seal"
          />
          <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-rule pt-5">
            <input type="checkbox" name="confirmAuthorization" className="mt-1" required />
            <span className="text-ink">I confirm AVAIA is granting this Certified AVAIA Guide coordination support authorization.</span>
          </label>
          <button
            type="submit"
            className="mt-4 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Grant coordination support authorization
          </button>
        </form>
      ) : (
        <p className="mt-8 text-muted">This Guide does not currently hold an active certification, so this cannot be granted.</p>
      )}
    </div>
  );
}
