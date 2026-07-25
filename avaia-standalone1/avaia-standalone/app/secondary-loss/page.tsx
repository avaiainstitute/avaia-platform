import Link from "next/link";
import { SECONDARY_LOSSES } from "@/lib/institution";
import { familyOf } from "@/lib/virtues";

export const metadata = { title: "Secondary Loss — AVAIA" };

export default function SecondaryLossPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="label mb-3">Core Engine</p>
      <h1 className="font-serif text-4xl text-ink">The Secondary Loss Engine</h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        When something is taken, the primary loss is usually seen at once. The
        secondary losses often remain hidden — and that is frequently where the
        pain lives. Bringing them into view increases understanding and opens the
        way to restoration. Each loss has a correlating virtue that tends to feel
        absent, and that can become the anecdote for healing.
      </p>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {SECONDARY_LOSSES.map((s) => {
          const fam = familyOf(s.healingFamily);
          return (
            <div
              key={s.loss}
              className="flex items-center justify-between gap-4 rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4"
            >
              <div>
                <p className="label text-muted">Loss of</p>
                <p className="font-serif text-lg text-ink">{s.loss}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted">→</span>
                <Link
                  href="/chemistry"
                  className="rounded-full px-3 py-1 font-sans text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: fam.color }}
                >
                  {s.healingLabel}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 max-w-prose text-sm text-muted">
        The pairing is a starting point for reflection, not a formula for a
        person. It surfaces a strength worth cultivating — it does not diagnose,
        assume, or assign blame.
      </p>
    </div>
  );
}
