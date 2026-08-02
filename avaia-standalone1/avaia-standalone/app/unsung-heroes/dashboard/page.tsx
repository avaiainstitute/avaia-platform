import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { familyOf, type VirtueFamilyKey } from "@/lib/virtues";

export const metadata = { title: "Unsung Heroes Dashboard — AVAIA" };
export const dynamic = "force-dynamic";

type Recognition = {
  id: string;
  observer_id: string;
  observed_name: string;
  observed_user_id: string | null;
  virtue_family: string;
  virtue_name: string | null;
  story: string;
  created_at: string;
};

export default async function UnsungHeroesDashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  // RLS already scopes this to exactly what this account is allowed to see —
  // their own given/received cards, plus anything their community_contacts
  // rows (teacher, school admin, guardian, business contact, community_leader)
  // grant visibility into. No extra filtering needed here for that reason.
  const { data } = await supabase
    .from("recognitions")
    .select("id, observer_id, observed_name, observed_user_id, virtue_family, virtue_name, story, created_at")
    .order("created_at", { ascending: false });
  const recognitions = (data as Recognition[]) ?? [];

  const given = recognitions.filter((r) => r.observer_id === user.id);
  const received = recognitions.filter((r) => r.observed_user_id === user.id);

  const virtueCounts = new Map<string, { label: string; family: string; n: number }>();
  for (const r of recognitions) {
    const key = r.virtue_name ?? `family:${r.virtue_family}`;
    const label = r.virtue_name ?? familyOf(r.virtue_family as VirtueFamilyKey).name;
    const entry = virtueCounts.get(key);
    if (entry) entry.n += 1;
    else virtueCounts.set(key, { label, family: r.virtue_family, n: 1 });
  }
  const topVirtues = [...virtueCounts.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
          AVAIA
        </Link>
        <SignOutButton />
      </div>

      <p className="label mb-3 mt-8">Unsung Heroes</p>
      <h1 className="font-serif text-4xl text-ink">Recognition Dashboard</h1>
      <p className="mt-4 text-lg text-muted">
        What you&rsquo;ve given, what you&rsquo;ve received, and the virtues showing up most in
        what you can see.
      </p>

      <div className="mt-6">
        <Link
          href="/unsung-heroes"
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Recognize someone
        </Link>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label text-muted">Given</p>
          <p className="mt-1 font-serif text-4xl text-ink">{given.length}</p>
        </div>
        <div className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
          <p className="label text-muted">Received</p>
          <p className="mt-1 font-serif text-4xl text-ink">{received.length}</p>
        </div>
      </div>

      {topVirtues.length > 0 && (
        <section className="mt-10">
          <p className="label text-muted">Most-recognized virtues</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {topVirtues.map((v) => (
              <span
                key={v.label}
                className="rounded-full px-3 py-1 text-sm text-white"
                style={{ backgroundColor: familyOf(v.family as VirtueFamilyKey).color }}
              >
                {v.label} <span className="opacity-80">×{v.n}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {recognitions.length === 0 && (
        <p className="mt-12 text-muted">Nothing recognized yet — that&rsquo;s where it starts.</p>
      )}

      {recognitions.length > 0 && (
        <section className="mt-12">
          <p className="label text-muted">Recent</p>
          <div className="mt-3 space-y-3">
            {recognitions.slice(0, 15).map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm"
              >
                <p className="font-serif text-lg text-ink">
                  {r.observed_name}
                  <span className="text-muted"> — {r.virtue_name ?? r.virtue_family}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{r.story}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
