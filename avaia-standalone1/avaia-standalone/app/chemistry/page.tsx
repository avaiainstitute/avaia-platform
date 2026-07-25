"use client";

import { useEffect, useState } from "react";
import {
  VIRTUES,
  VIRTUE_FAMILIES,
  familyOf,
  type Virtue,
  type VirtueFamilyKey,
} from "@/lib/virtues";
import { VIRTUE_POS, GRID_COLS, GRID_ROWS } from "@/lib/virtue-layout";

export default function ChemistryPage() {
  const [active, setActive] = useState<VirtueFamilyKey | null>(null);
  const [selected, setSelected] = useState<Virtue | null>(null);

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
        <div className="mt-6 flex items-start gap-4 rounded-lg border border-seal bg-white/[0.08] backdrop-blur-sm px-5 py-4">
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

      {/* Virtue formulas — framework defined, library grows over time */}
      <section className="rule-t mt-14 border-t border-rule pt-10">
        <p className="label mb-2">In development</p>
        <h2 className="font-serif text-2xl text-ink">Virtue Formulas</h2>
        <p className="mt-2 max-w-prose text-muted">
          Virtues rarely operate alone. A situation may call for a purposeful
          combination — a primary virtue, supporting virtues, and balancing
          virtues.
        </p>
        <p className="mt-4 rounded-lg border border-dashed border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4 text-center font-serif text-lg text-seal">
          Primary Virtue + Supporting Virtue(s) + Balancing Virtue(s) = Desired Outcome
        </p>
        <p className="mt-3 text-sm text-muted">
          The framework is defined; the official library of formulas is being
          built and will grow over time. Formulas come only from official AVAIA
          source material — none are generated here.
        </p>
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
