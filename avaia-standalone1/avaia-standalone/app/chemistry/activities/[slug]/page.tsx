import Link from "next/link";
import { notFound } from "next/navigation";
import { getActivitySet } from "@/lib/chemistry-activities";
import { VIRTUE_FAMILIES } from "@/lib/virtues";

export function generateMetadata({ params }: { params: { slug: string } }) {
  const set = getActivitySet(params.slug);
  return { title: set ? `${set.elementName} Activities | AVAIA` : "Chemistry Activities | AVAIA" };
}

export default function ElementActivityPage({ params }: { params: { slug: string } }) {
  const set = getActivitySet(params.slug);
  if (!set) notFound();

  const family = VIRTUE_FAMILIES.find((f) => f.key === set.familyKey)!;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <Link href="/chemistry/activities" className="font-sans text-sm text-muted hover:text-seal">
        ← All Printable Activities
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 font-serif text-base font-semibold"
          style={{ borderColor: family.color, color: family.color }}
        >
          {set.symbol}
        </div>
        <div>
          <h1 className="font-serif text-3xl text-ink leading-tight">{set.elementName}</h1>
          <p className="text-xs uppercase tracking-[0.14em]" style={{ color: family.color }}>
            {family.name} Family
          </p>
        </div>
      </div>

      <p className="mt-5 text-muted">
        From the story &ldquo;{set.storyTitle}.&rdquo; Read it (or listen to it) first on{" "}
        <Link href="/chemistry/family" className="text-seal hover:underline">
          Chemistry for Families &amp; Kids
        </Link>
        , then print any of the five activities below.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs">
        {["Read", "Listen", "Watch (future)", "Color / Create", "Notice"].map((step, i) => (
          <span key={step} className="flex items-center gap-2">
            <span className="rounded-full border border-rule px-3 py-1 text-muted">{step}</span>
            {i < 4 && <span className="text-muted">→</span>}
          </span>
        ))}
      </div>

      <div className="mt-10 space-y-3">
        {set.pages.map((p) => (
          <Link
            key={p.id}
            href={`/chemistry/activities/${set.elementSlug}/${p.id}`}
            className="flex items-center justify-between rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
          >
            <div>
              <p className="font-serif text-lg text-ink">{p.title}</p>
              <p className="text-sm text-muted">{p.blurb}</p>
            </div>
            <span className="rounded-full border border-rule px-3 py-1 text-xs text-muted">
              {p.ageBand === "both" ? "All ages" : p.ageBand === "younger" ? "Younger" : "Older"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
