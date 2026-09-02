import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { familyOf, type VirtueFamilyKey } from "@/lib/virtues";
import { VirtueLink } from "@/components/VirtueLink";

export const metadata = { title: "Unsung Heroes — AVAIA" };
export const dynamic = "force-dynamic";

type Recognition = {
  id: string;
  observer_id: string;
  observed_user_id: string | null;
  title: string;
  who_became_visible: string;
  story: string;
  virtue_family: string;
  primary_virtue: string | null;
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
  // their own given/received entries, plus anything their community_contacts
  // rows (teacher, school admin, guardian, business contact, community_leader)
  // grant visibility into. No extra filtering needed here for that reason.
  const { data } = await supabase
    .from("recognitions")
    .select("id, observer_id, observed_user_id, title, who_became_visible, story, virtue_family, primary_virtue, created_at")
    .order("created_at", { ascending: false });
  const recognitions = (data as Recognition[]) ?? [];

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
          AVAIA
        </Link>
        <SignOutButton />
      </div>

      <p className="label mb-3 mt-8">Unsung Heroes</p>
      <h1 className="font-serif text-4xl text-ink">Virtue, Recognized</h1>
      <p className="mt-4 text-lg text-muted">
        A record of the virtue you&rsquo;ve noticed in the people around you — named, and
        acknowledged out loud. Not a tally to keep score by; a workbook of what you saw.
      </p>

      <div className="mt-6">
        <Link
          href="/unsung-heroes"
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Notice someone
        </Link>
      </div>

      {recognitions.length === 0 && (
        <p className="mt-12 text-muted">
          Nothing recorded yet — that&rsquo;s where every one of these starts. Most virtue goes
          unacknowledged only because no one paused long enough to name it.
        </p>
      )}

      {recognitions.length > 0 && (
        <section className="mt-12">
          <p className="label text-muted">Virtue you&rsquo;ve noticed</p>
          <div className="mt-3 space-y-3">
            {recognitions.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-serif text-lg text-ink">{r.title}</p>
                  {r.primary_virtue && (
                    <VirtueLink
                      family={r.virtue_family}
                      virtue={r.primary_virtue}
                      className="shrink-0 rounded-full px-3 py-0.5 text-xs text-white transition-opacity hover:opacity-80"
                      style={{ backgroundColor: familyOf(r.virtue_family as VirtueFamilyKey).color }}
                    >
                      {r.primary_virtue}
                    </VirtueLink>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  <span className="text-ink">{r.who_became_visible}</span> — recognized for it
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{r.story}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
