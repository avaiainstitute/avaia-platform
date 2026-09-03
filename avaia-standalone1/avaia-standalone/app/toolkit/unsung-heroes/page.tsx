import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { startUnsungHeroesSession } from "@/lib/engine/unsung-heroes";
import GuideYouthConsentFields from "@/components/GuideYouthConsentFields";
import { UNSUNG_HEROES_PATH_LABEL, type UnsungHeroesPath } from "@/lib/engine/prompts";

export const metadata = { title: "Unsung Heroes — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

const PATHS = Object.keys(UNSUNG_HEROES_PATH_LABEL) as UnsungHeroesPath[];

export default async function ToolkitUnsungHeroesPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Programs</p>
      <h1 className="font-serif text-4xl text-ink">Unsung Heroes</h1>
      <p className="mt-4 text-lg text-muted">
        A short, guided conversation to help a participant name a quiet act of virtue — one they
        witnessed, one they received, or one they&rsquo;re hoping to grow into.
      </p>

      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </p>
      )}

      <form action={startUnsungHeroesSession} className="mt-8 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label mb-2 block" htmlFor="name">
              Participant name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
          <div>
            <label className="label mb-2 block" htmlFor="email">
              Email (optional — links to their AVAIA account if they have one)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
            />
          </div>
        </div>

        <GuideYouthConsentFields bandOptional />

        <fieldset className="mt-5">
          <legend className="label mb-2">Path</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PATHS.map((p, i) => (
              <label
                key={p}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-white/[0.03] px-4 py-3"
              >
                <input type="radio" name="path" value={p} defaultChecked={i === 0} required />
                <span className="text-sm text-ink">{UNSUNG_HEROES_PATH_LABEL[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-5 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Begin Unsung Heroes
        </button>
      </form>
    </div>
  );
}
