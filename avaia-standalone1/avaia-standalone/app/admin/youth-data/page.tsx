import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Youth Data — Admin — AVAIA" };
export const dynamic = "force-dynamic";

type ParticipantResult = { id: string; name: string; email: string | null; guide_id: string };

/** Youth data retention/deletion, admin-only. Search by participant name/
 *  email (Guide-facilitated) or by a self-serve Youth Host's account
 *  email -- two different underlying tables (guide_participants vs
 *  profiles), same operational need: find the record, see what's there,
 *  delete it on request. See lib/youth-data-deletion.ts for the actual
 *  cascading delete and the full data-category map. */
export default async function AdminYouthDataPage({
  searchParams,
}: {
  searchParams?: { q?: string; error?: string; deleted?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/youth-data");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  const q = (searchParams?.q ?? "").trim();
  let participantResults: ParticipantResult[] = [];
  let hostResult: { id: string; email: string; developmental_band: string | null } | null = null;

  if (q) {
    const { data: participants } = await supabase
      .from("guide_participants")
      .select("id, name, email, guide_id")
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .not("developmental_band", "is", null)
      .limit(20);
    participantResults = (participants as ParticipantResult[]) ?? [];

    if (q.includes("@")) {
      const admin = createAdminClient();
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data) break;
        const match = data.users.find((u) => u.email?.toLowerCase() === q.toLowerCase());
        if (match) {
          const { data: hostProfile } = await supabase
            .from("profiles")
            .select("id, developmental_band")
            .eq("id", match.id)
            .maybeSingle();
          if (hostProfile) {
            hostResult = { id: match.id, email: match.email ?? q, developmental_band: hostProfile.developmental_band };
          }
          break;
        }
        if (data.users.length < 1000) break;
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink">Youth Data Retention / Deletion</h1>
      <p className="mt-4 text-lg text-muted">
        Find a Youth-linked record — a Guide-facilitated participant or a self-serve Youth Host&rsquo;s
        account — and see or delete every record linked to it. The retention PERIOD is not yet a
        settled policy; this is the technical ability to act on whatever that policy ends up being,
        available now.
      </p>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      {searchParams?.deleted && (
        <div className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          <p className="mb-1 font-semibold">Deleted.</p>
          <pre className="whitespace-pre-wrap text-xs text-muted">
            {JSON.stringify(JSON.parse(searchParams.deleted), null, 2)}
          </pre>
        </div>
      )}

      <form className="mt-8 flex gap-3" action="/admin/youth-data">
        <input
          name="q"
          type="text"
          defaultValue={q}
          placeholder="Participant name, participant email, or Youth Host account email"
          className="flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
        />
        <button
          type="submit"
          className="rounded-md border border-rule px-5 py-3 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Search
        </button>
      </form>

      {q && participantResults.length === 0 && !hostResult && (
        <p className="mt-8 text-muted">No Youth-linked record found for &ldquo;{q}&rdquo;.</p>
      )}

      {participantResults.length > 0 && (
        <section className="mt-8">
          <p className="label mb-3 text-muted">Guide-Facilitated Participants</p>
          <div className="space-y-2">
            {participantResults.map((p) => (
              <Link
                key={p.id}
                href={`/admin/youth-data/participant/${p.id}`}
                className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
              >
                <p className="text-ink">{p.name}</p>
                <p className="text-xs text-muted">{p.email ?? "No email on file"}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {hostResult && (
        <section className="mt-8">
          <p className="label mb-3 text-muted">Self-Serve Youth Host</p>
          <Link
            href={`/admin/youth-data/host/${hostResult.id}`}
            className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="text-ink">{hostResult.email}</p>
            <p className="text-xs text-muted">
              {hostResult.developmental_band ? `Band: ${hostResult.developmental_band}` : "No band on record"}
            </p>
          </Link>
        </section>
      )}
    </div>
  );
}
