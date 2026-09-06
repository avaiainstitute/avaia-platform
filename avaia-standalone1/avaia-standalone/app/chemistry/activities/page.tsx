"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getAllActivitySets } from "@/lib/chemistry-activities";
import { VIRTUE_FAMILIES, VIRTUES, type VirtueFamilyKey } from "@/lib/virtues";

const ALL_SETS = getAllActivitySets();
const TOTAL_ELEMENTS = VIRTUES.length;

export default function ChemistryActivitiesIndexPage() {
  const [search, setSearch] = useState("");
  const [activeFamily, setActiveFamily] = useState<VirtueFamilyKey | null>(null);

  const familyCoverage = useMemo(() => {
    const map = new Map<VirtueFamilyKey, number>();
    for (const s of ALL_SETS) map.set(s.familyKey, (map.get(s.familyKey) ?? 0) + 1);
    return map;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ALL_SETS.filter((s) => {
      if (activeFamily && s.familyKey !== activeFamily) return false;
      if (q && !s.elementName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, activeFamily]);

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
All {TOTAL_ELEMENTS} canonical elements have a full activity set. Four (Kindness, Courage,
        Patience, Appreciation) have a hand-drawn scene from their story and a bespoke puzzle; the
        rest use a decorative &ldquo;Color the Word&rdquo; page and a maze in their place until
        more bespoke scenes are illustrated.
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search an element (e.g. Courage, Patience)…"
        className="mt-6 w-full rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFamily(null)}
          className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
            activeFamily === null ? "border-seal bg-seal text-[#05060b]" : "border-rule text-muted hover:border-seal"
          }`}
        >
          All Families
        </button>
        {VIRTUE_FAMILIES.map((f) => {
          const count = familyCoverage.get(f.key) ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFamily(activeFamily === f.key ? null : f.key)}
              className="rounded-full border px-3 py-1 font-sans text-xs font-medium transition-all"
              style={{
                borderColor: f.color,
                backgroundColor: activeFamily === f.key ? f.color : "transparent",
                color: activeFamily === f.key ? "#fff" : f.color,
              }}
            >
              {f.name} ({count})
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted">No element matches that search.</p>
        )}
        {filtered.map((set) => {
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
