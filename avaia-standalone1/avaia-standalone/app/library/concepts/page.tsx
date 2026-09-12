import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPublishedConcepts } from "@/lib/library-concepts";

export const metadata = { title: "Concepts, AVAIA Library" };
export const dynamic = "force-dynamic";

/** The Library's concept index (Phase 2 of the Library completion work).
 *  Before this page existed, a concept was reachable only by accident,
 *  through an entry's "Related ideas" or another concept's own related-
 *  concepts list, never by simply browsing what concepts exist. This is
 *  a plain list, not a graph visualization, "keep this simple" per the
 *  work order, following any concept still works the same way it always
 *  has, from the concept's own page. */
export default async function LibraryConceptsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library/concepts");

  const { data: youthCheck } = await supabase
    .from("profiles")
    .select("minor_with_guardian")
    .eq("id", user.id)
    .maybeSingle();
  if (youthCheck?.minor_with_guardian) redirect("/youth");

  const concepts = await listPublishedConcepts(supabase);

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/library" className="label hover:text-seal">
          ← Back to the Library
        </Link>
      </p>

      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">Concepts</h1>
      <p className="mt-4 text-lg text-muted">
        The ideas the Library has explored in depth, each with its own related questions,
        entries, and historical voices.
      </p>

      {concepts.length === 0 ? (
        <p className="mt-10 text-muted">Nothing published yet.</p>
      ) : (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {concepts.map((c) => (
            <Link
              key={c.id}
              href={`/library/concepts/${c.id}`}
              className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
            >
              <p className="font-serif text-lg text-ink">{c.name}</p>
              {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
