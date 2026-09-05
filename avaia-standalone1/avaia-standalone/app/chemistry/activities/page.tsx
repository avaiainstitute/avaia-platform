import Link from "next/link";
import { ACTIVITY_PILOT } from "@/lib/chemistry-activities";
import { VIRTUE_FAMILIES } from "@/lib/virtues";

export const metadata = {
  title: "Chemistry for Kids -- Printable Activities | AVAIA",
};

export default function ChemistryActivitiesIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="label mb-3">Chemistry of Virtue</p>
      <h1 className="font-serif text-4xl text-ink leading-tight">
        Chemistry for Kids -- Printable Activities
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Alongside reading and listening to a story, a child can color it, trace it, draw
        themselves in it, and notice it out in the world -- something to print, hold, and use
        with their hands.
      </p>
      <p className="mt-3 text-sm text-muted">
        This is an early pilot covering {ACTIVITY_PILOT.length} of 123 canonical elements -- the
        ones with a finished story already. The same system is built to grow to cover every
        element, and eventually to assemble into full virtue-family coloring books.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {ACTIVITY_PILOT.map((set) => {
          const family = VIRTUE_FAMILIES.find((f) => f.key === set.familyKey)!;
          return (
            <Link
              key={set.elementSlug}
              href={`/chemistry/activities/${set.elementSlug}`}
              className="rounded-lg border border-rule bg-white/[0.04] p-5 transition-colors hover:border-seal"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 font-serif text-sm font-semibold"
                  style={{ borderColor: family.color, color: family.color }}
                >
                  {set.symbol}
                </div>
                <div>
                  <p className="font-serif text-lg text-ink">{set.elementName}</p>
                  <p className="text-xs" style={{ color: family.color }}>
                    {family.name} Family
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted">
                5 activities from &ldquo;{set.storyTitle}&rdquo;
              </p>
            </Link>
          );
        })}
      </div>

      <div className="rule-t mt-14 border-t border-rule pt-8">
        <Link href="/chemistry/family" className="font-sans text-sm text-muted hover:text-seal">
          ← Back to Chemistry for Families &amp; Kids
        </Link>
      </div>
    </div>
  );
}
