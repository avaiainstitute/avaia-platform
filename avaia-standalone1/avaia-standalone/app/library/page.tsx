import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLibraryEntriesForHost, formatReason } from "@/lib/library-retrieval";

export const metadata = { title: "Library — AVAIA" };
export const dynamic = "force-dynamic";

/** The Living Library's permanent entrance. Independently returnable --
 *  works with or without ?journey=<id>. When present and it actually
 *  belongs to this Host, it's used to ground retrieval in that Journey's
 *  own referrals (see lib/library-retrieval.ts); otherwise, and whenever
 *  there isn't enough legitimate matched evidence, a broad reviewed set is
 *  shown instead -- never a fabricated personal reason. This is the same
 *  optional-searchParam pattern already used by /journey?new=1&program=...
 *  and /unsung-heroes?path=... -- no new session state, no second
 *  persistence mechanism. */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams?: { journey?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/library`);

  const result = await getLibraryEntriesForHost(supabase, user.id, searchParams?.journey ?? null);

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">The AVAIA Library</h1>

      {result.mode === "personalized" ? (
        <p className="mt-4 text-lg text-muted">
          Because of what became visible in your Journey, these are worth a look.
        </p>
      ) : result.journeyId ? (
        <p className="mt-4 text-lg text-muted">
          There wasn&rsquo;t enough from that Journey yet to personalize this safely — here&rsquo;s
          the reviewed Library instead.
        </p>
      ) : (
        <p className="mt-4 text-lg text-muted">
          A reviewed starting set from the AVAIA Library.
        </p>
      )}

      <p className="mt-6">
        <Link href="/library/mine" className="text-sm text-muted hover:text-seal">
          My Library →
        </Link>
      </p>

      {result.entries.length === 0 ? (
        <p className="mt-12 text-muted">Nothing published yet.</p>
      ) : (
        <div className="mt-10 space-y-3">
          {result.entries.map(({ entry, reasons }) => (
            <Link
              key={entry.id}
              href={`/library/${entry.id}`}
              className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
            >
              <p className="font-serif text-lg text-ink">{entry.title}</p>
              <p className="mt-1 text-sm text-muted">{entry.overview}</p>
              {reasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {reasons.map((r, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-rule px-3 py-0.5 text-xs text-muted"
                    >
                      {formatReason(r)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
