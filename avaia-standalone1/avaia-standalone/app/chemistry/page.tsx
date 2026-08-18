"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  VIRTUES,
  VIRTUE_FAMILIES,
  familyOf,
  type Virtue,
  type VirtueFamilyKey,
} from "@/lib/virtues";
import { VIRTUE_POS, GRID_COLS, GRID_ROWS } from "@/lib/virtue-layout";
import VirtueFormulaGenerator from "@/components/VirtueFormulaGenerator";
import VirtueNameAcronym from "@/components/VirtueNameAcronym";

export default function ChemistryPage() {
  const [active, setActive] = useState<VirtueFamilyKey | null>(null);
  const [selected, setSelected] = useState<Virtue | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [scrollToken, setScrollToken] = useState(0);

  // If the Host was just referred to a virtue in the journey, arrive with that
  // family lit and that virtue selected — continuity across the two tabs.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("avaia:focus");
      if (!raw) return;
      const f = JSON.parse(raw) as { familyKey?: string; virtueName?: string | null };
      if (f?.familyKey) setActive(f.familyKey as VirtueFamilyKey);
      if (f?.virtueName) {
        const v = VIRTUES.find((x) => x.name === f.virtueName);
        if (v) setSelected(v);
      }
    } catch {
      /* no stored focus — open the table normally */
    }
  }, []);

  // Scrolls the existing detail panel into view -- only when selection was
  // triggered from somewhere off-screen (a Formula pill), not from a direct
  // table click, which is already next to the panel.
  useEffect(() => {
    if (scrollToken === 0) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [scrollToken]);

  function selectByName(name: string) {
    const v = VIRTUES.find((x) => x.name === name);
    if (!v) return;
    setSelected(v);
    setActive(v.family);
    setScrollToken((t) => t + 1);
  }

  const activeFamily = active ? familyOf(active) : null;

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="label mb-3">Core Engine</p>
      <h1 className="font-serif text-4xl text-ink">
        The Chemistry of Virtue<span className="align-super text-base">™</span>
      </h1>
      <p className="mt-4 max-w-prose text-lg text-muted">
        {VIRTUES.length} virtues across {VIRTUE_FAMILIES.length} families. In
        AVAIA these are the elements a conversation works with — how strengths
        interact to support understanding, restoration, and intentional
        participation. Every name and definition here is drawn from the AVAIA
        source materials.
      </p>

      {/* Orientation — read before dropping into the interactive table. */}
      <section className="mt-8 rounded-lg border border-rule bg-white/[0.03] px-5 py-6 backdrop-blur-sm">
        <p className="label mb-2 text-muted">How to read this</p>
        <p className="text-ink">
          AVAIA calls this the Chemistry of Virtue because it works the way the real periodic
          table does: 10 broad families of strength — like Wisdom or Justice — each contain
          several individual elements, like Discernment or Fairness. Every element here is a
          virtue; &ldquo;family&rdquo; and &ldquo;element&rdquo; are just two different scales
          of the same 123 virtues.
        </p>
        <p className="mt-5 text-center font-serif text-lg text-seal">
          Families → Elements → Formulas → How it shows up in your life
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {VIRTUE_FAMILIES.map((f) => (
            <div
              key={f.key}
              className="flex items-start gap-3 rounded-md border border-rule bg-white/[0.03] px-4 py-3"
            >
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: f.color }}
                aria-hidden
              />
              <div>
                <p className="font-serif text-ink">{f.name}</p>
                <p className="text-sm text-muted">{f.definition}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-rule pt-5">
          <p className="label mb-2 text-muted">What you can do here</p>
          <ul className="space-y-1 text-sm text-ink">
            <li>Browse the table below and tap any element to read its definition.</li>
            <li>Generate a Virtue Formula for a role, feeling, or situation you name.</li>
            <li>Spell your name and see which elements it maps to.</li>
          </ul>
        </div>
      </section>

      {/* Three doors framing */}
      <div className="mt-8 rounded-lg border border-dashed border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
        <p className="label mb-2 text-muted">Three ways in</p>
        <p className="text-ink">
          Identity, Capacity, and Connection aren&rsquo;t three separate features here — they&rsquo;re
          three doors into the same thing. What Your Name Spells is who you already are. A Virtue
          Formula names capacities available to you. And{" "}
          <Link href="/unsung-heroes" className="underline decoration-rule underline-offset-2 hover:text-seal">
            Unsung Heroes
          </Link>{" "}
          is where you learn to recognize those same capacities alive in someone else.
        </p>
        <p className="mt-3 text-sm text-muted">
          This same table is what every AVAIA conversation draws on — it&rsquo;s also how the{" "}
          <Link href="/secondary-loss" className="underline decoration-rule underline-offset-2 hover:text-seal">
            Secondary Loss Engine
          </Link>{" "}
          pairs each loss with the virtue that tends to feel absent alongside it.
        </p>
      </div>

      {/* Legend / family filter */}
      <div className="mt-10 flex flex-wrap gap-2">
        <button
          onClick={() => setActive(null)}
          className={`rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors ${
            active === null ? "border-seal bg-seal text-[#05060b]" : "border-rule text-muted hover:border-seal"
          }`}
        >
          All families
        </button>
        {VIRTUE_FAMILIES.map((f) => (
          <button
            key={f.key}
            onClick={() => setActive(active === f.key ? null : f.key)}
            className="rounded-full border px-3 py-1 font-sans text-xs font-medium transition-all"
            style={{
              borderColor: f.color,
              backgroundColor: active === f.key ? f.color : "transparent",
              color: active === f.key ? "#fff" : f.color,
            }}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* Active family definition */}
      {activeFamily && (
        <div
          className="mt-6 rounded-lg border-l-4 bg-white/[0.06] backdrop-blur-sm px-5 py-4"
          style={{ borderColor: activeFamily.color }}
        >
          <p className="font-serif text-lg" style={{ color: activeFamily.color }}>
            {activeFamily.name}
          </p>
          <p className="mt-1 text-ink">{activeFamily.definition}</p>
        </div>
      )}

      {/* Selected virtue detail */}
      {selected && (
        <div
          ref={detailRef}
          className="mt-6 flex items-start gap-4 rounded-lg border border-seal bg-white/[0.08] backdrop-blur-sm px-5 py-4 scroll-mt-24"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-sans text-sm font-bold text-white"
            style={{ backgroundColor: familyOf(selected.family).color }}
          >
            {selected.symbol}
          </div>
          <div className="flex-1">
            <p className="font-serif text-lg text-ink">{selected.name}</p>
            <p className="label" style={{ color: familyOf(selected.family).color }}>
              {familyOf(selected.family).name}
            </p>
            {selected.definition && (
              <p className="mt-2 text-ink">{selected.definition}</p>
            )}
          </div>
          <button
            onClick={() => setSelected(null)}
            className="label shrink-0 text-muted hover:text-seal"
          >
            Close
          </button>
        </div>
      )}

      {/* Periodic table — laid out to mirror the official artwork.
          Horizontally scrollable on narrow screens (like a real periodic table). */}
      <div className="mt-8 overflow-x-auto pb-2">
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, auto)`,
            minWidth: "880px",
          }}
        >
          {VIRTUES.map((v) => {
            const fam = familyOf(v.family);
            const pos = VIRTUE_POS[v.name];
            if (!pos) return null;
            const dim = active !== null && active !== v.family;
            const isSel = selected?.name === v.name;
            return (
              <button
                key={v.name}
                onClick={() => {
                  setSelected(v);
                  setActive(v.family);
                }}
                title={`${v.name} · ${fam.name}`}
                className="flex aspect-square flex-col justify-between rounded-[3px] p-1 text-left text-white transition-all hover:z-10 hover:brightness-110"
                style={{
                  gridRow: pos[0],
                  gridColumn: pos[1],
                  backgroundColor: fam.color,
                  opacity: dim ? 0.14 : 1,
                  outline: isSel ? "2px solid #e9eef4" : "none",
                  outlineOffset: "1px",
                }}
              >
                <span className="font-sans text-[0.62rem] font-bold leading-none">
                  {v.symbol}
                </span>
                <span className="font-sans text-[0.44rem] leading-[1.05] tracking-tight">
                  {v.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        Showing {activeFamily ? activeFamily.name : "all"} —{" "}
        {(active ? VIRTUES.filter((v) => v.family === active) : VIRTUES).length} virtues.
        Tap any element to read its definition. On a phone, scroll the table sideways.
      </p>

      {/* Virtue formulas — generated live from the real 123 elements */}
      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2">Generated live · Capacity</p>
        <h2 className="font-serif text-2xl text-ink">Virtue Formulas</h2>
        <p className="mt-2 max-w-prose text-muted">
          Virtues rarely operate alone. Describe a role, a feeling, or a
          situation, and AVAIA will assemble a purposeful combination — a
          primary virtue, supporting virtues, and balancing virtues — using
          only real Chemistry of Virtue elements. Nothing is invented; every
          name shown is checked against the table above.
        </p>
        <p className="mt-3 text-center font-serif text-lg text-seal">
          Primary Virtue + Supporting Virtue(s) + Balancing Virtue(s) = Desired Outcome
        </p>
        <div className="mt-6">
          <VirtueFormulaGenerator onSelectVirtue={selectByName} />
        </div>
      </section>

      {/* Name-to-virtue acronym */}
      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2">A self-definition, not a game · Identity</p>
        <h2 className="font-serif text-2xl text-ink">What Your Name Spells</h2>
        <p className="mt-2 max-w-prose text-muted">
          Type a name, and each letter maps to a real element of the
          Chemistry of Virtue — a way to define yourself in your own words,
          the way people already know you by your first name before
          anything else. Every letter has a real element except Q, which
          doesn&rsquo;t appear anywhere in the Chemistry of Virtue — that
          letter is shown honestly rather than forced.
        </p>
        <div className="mt-6">
          <VirtueNameAcronym />
        </div>
      </section>

      {/* Distortions — reserved future capability */}
      <section className="mt-10">
        <p className="label mb-2 text-muted">Future capability</p>
        <p className="max-w-prose text-sm text-muted">
          <span className="font-serif text-ink">Virtue Distortions</span> — a
          planned extension of the Chemistry of Virtue — are reserved for when
          official AVAIA content is developed. No definitions or logic are
          implemented until then.
        </p>
      </section>
    </div>
  );
}
