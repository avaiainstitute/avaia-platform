import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Reassign Participant — Admin — AVAIA" };
export const dynamic = "force-dynamic";

type ParticipantResult = {
  id: string;
  name: string;
  email: string | null;
  guide_id: string;
  developmental_band: string | null;
  guide_email: string | null;
};
type GuideOption = { id: string; email: string | null };

/** Found missing during the multi-organization/multi-Guide scaling audit:
 *  guide_participants.guide_id is a single, fixed owner with no existing
 *  way to move a participant from one Guide to another -- relevant when a
 *  Guide leaves an organization, or a program is reassigned. Reuses the
 *  EXISTING admin trust boundary (the same one that already reaches
 *  across every Guide's data for search/deletion in /admin/youth-data)
 *  rather than inventing a new one -- deliberately not a Guide-to-Guide
 *  self-service handoff, which would need its own consent/notification
 *  workflow this pass has no evidence is actually needed yet. Preserves
 *  every session, referral, consent, and Signature entry exactly as they
 *  were -- only guide_id changes, so continuity is never dropped. */
async function reassignParticipant(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/reassign-participant");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const participantId = String(formData.get("participantId") ?? "");
  const newGuideId = String(formData.get("newGuideId") ?? "");
  const q = String(formData.get("q") ?? "");
  if (!participantId || !newGuideId) {
    redirect(`/admin/reassign-participant?q=${encodeURIComponent(q)}&error=${encodeURIComponent("Missing participant or target Guide.")}`);
  }

  const admin = createAdminClient();

  // Re-verify the target actually holds toolkit authorization right now --
  // never trust a hidden form field alone for who receives someone's
  // private record.
  const { data: targetAuth } = await admin
    .from("guide_platform_authorizations")
    .select("id")
    .eq("host_id", newGuideId)
    .eq("capability", "toolkit")
    .eq("status", "authorized")
    .maybeSingle();
  if (!targetAuth) {
    redirect(`/admin/reassign-participant?q=${encodeURIComponent(q)}&error=${encodeURIComponent("Target is not a currently toolkit-authorized Guide.")}`);
  }

  const { error } = await admin
    .from("guide_participants")
    .update({ guide_id: newGuideId })
    .eq("id", participantId);
  if (error) {
    redirect(`/admin/reassign-participant?q=${encodeURIComponent(q)}&error=${encodeURIComponent("Reassignment failed.")}`);
  }

  redirect(`/admin/reassign-participant?q=${encodeURIComponent(q)}&reassigned=1`);
}

export default async function AdminReassignParticipantPage({
  searchParams,
}: {
  searchParams?: { q?: string; error?: string; reassigned?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/reassign-participant");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const admin = createAdminClient();
  const q = (searchParams?.q ?? "").trim();
  let participantResults: ParticipantResult[] = [];

  if (q) {
    const { data: participants } = await admin
      .from("guide_participants")
      .select("id, name, email, guide_id, developmental_band")
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(20);
    const rows = participants ?? [];
    const guideIds = Array.from(new Set(rows.map((r) => r.guide_id)));
    const emailByGuide = new Map<string, string | null>();
    for (const gid of guideIds) {
      const { data: u } = await admin.auth.admin.getUserById(gid);
      emailByGuide.set(gid, u?.user?.email ?? null);
    }
    participantResults = rows.map((r) => ({ ...r, guide_email: emailByGuide.get(r.guide_id) ?? null }));
  }

  // Every currently toolkit-authorized Guide -- the only legitimate
  // reassignment targets. Small population by design (this is an
  // admin-mediated, deliberate action, not a general directory).
  const { data: authRows } = await admin
    .from("guide_platform_authorizations")
    .select("host_id")
    .eq("capability", "toolkit")
    .eq("status", "authorized");
  const guideOptions: GuideOption[] = [];
  for (const row of authRows ?? []) {
    const { data: u } = await admin.auth.admin.getUserById(row.host_id);
    guideOptions.push({ id: row.host_id, email: u?.user?.email ?? null });
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin" className="label hover:text-seal">
          ← Back to Admin
        </Link>
      </p>
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink">Reassign Participant</h1>
      <p className="mt-3 text-muted">
        Moves a Guide-facilitated participant record to a different, currently toolkit-authorized
        Guide. Every session, referral, consent, and Signature entry stays exactly as it was &mdash;
        only who facilitates going forward changes.
      </p>

      {searchParams?.reassigned && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Reassigned.
        </p>
      )}
      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <form action="/admin/reassign-participant" className="mt-8 flex gap-3">
        <input
          name="q"
          type="text"
          defaultValue={q}
          placeholder="Participant name or email"
          className="flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
        />
        <button
          type="submit"
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      {q && participantResults.length === 0 && <p className="mt-6 text-muted">No participant found for &ldquo;{q}&rdquo;.</p>}

      {participantResults.length > 0 && (
        <div className="mt-8 space-y-4">
          {participantResults.map((p) => (
            <div key={p.id} className="rounded-lg border border-rule bg-white/[0.04] p-5">
              <p className="text-ink">
                {p.name}
                {p.developmental_band && (
                  <span className="ml-2 rounded-full border border-seal/40 bg-seal/[0.08] px-2 py-0.5 align-middle text-xs text-ink">
                    Youth · {p.developmental_band}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                {p.email ?? "No email on file"} · Currently facilitated by {p.guide_email ?? p.guide_id}
              </p>
              <form action={reassignParticipant} className="mt-4 flex flex-wrap items-center gap-3">
                <input type="hidden" name="participantId" value={p.id} />
                <input type="hidden" name="q" value={q} />
                <select
                  name="newGuideId"
                  required
                  className="rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-sm text-ink outline-none backdrop-blur-sm focus:border-seal"
                >
                  <option value="" className="bg-[#05060b]">
                    — Select the new Guide —
                  </option>
                  {guideOptions
                    .filter((g) => g.id !== p.guide_id)
                    .map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#05060b]">
                        {g.email ?? g.id}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-rule px-4 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
                >
                  Reassign
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
