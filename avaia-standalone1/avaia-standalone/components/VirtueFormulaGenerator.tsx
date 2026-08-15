"use client";

import { useState } from "react";
import { VIRTUES, familyOf } from "@/lib/virtues";

type Formula = {
  primaryVirtue: string;
  supportingVirtues: string[];
  balancingVirtues: string[];
  desiredOutcome: string;
};

function familyColorFor(name: string): string {
  const v = VIRTUES.find((x) => x.name === name);
  return v ? familyOf(v.family).color : "#9aa4b2";
}

function VirtuePill({ name }: { name: string }) {
  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-sm text-white"
      style={{ backgroundColor: familyColorFor(name) }}
    >
      {name}
    </span>
  );
}

/** Describes a role or situation in your own words; AVAIA assembles a
 *  Primary + Supporting + Balancing formula from the real 123 elements --
 *  generated live, not looked up from a curated library. See the route's
 *  own comments for why every name it returns is validated against the
 *  real Chemistry of Virtue before being shown. */
export default function VirtueFormulaGenerator() {
  const [description, setDescription] = useState("");
  const [formula, setFormula] = useState<Formula | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || loading) return;
    setLoading(true);
    setError("");
    setFormula(null);
    try {
      const res = await fetch("/api/chemistry/virtue-formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not generate a formula.");
      setFormula(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={generate} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe a role, a feeling, or a situation -- e.g. &ldquo;being a present dad&rdquo;"
          maxLength={600}
          className="flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
        <button
          type="submit"
          disabled={!description.trim() || loading}
          className="shrink-0 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Assembling…" : "Generate"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}

      {formula && (
        <div className="mt-6 space-y-4 rounded-lg border border-dashed border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-5">
          <div>
            <p className="label mb-2 text-muted">Primary</p>
            <VirtuePill name={formula.primaryVirtue} />
          </div>
          {formula.supportingVirtues.length > 0 && (
            <div>
              <p className="label mb-2 text-muted">Supporting</p>
              <div className="flex flex-wrap gap-2">
                {formula.supportingVirtues.map((n) => (
                  <VirtuePill key={n} name={n} />
                ))}
              </div>
            </div>
          )}
          {formula.balancingVirtues.length > 0 && (
            <div>
              <p className="label mb-2 text-muted">Balancing</p>
              <div className="flex flex-wrap gap-2">
                {formula.balancingVirtues.map((n) => (
                  <VirtuePill key={n} name={n} />
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-rule pt-4">
            <p className="label mb-1 text-muted">What this supports</p>
            <p className="font-serif text-lg text-ink">{formula.desiredOutcome}</p>
          </div>
          <div className="border-t border-rule pt-4">
            <p className="text-ink">
              These virtues are all around you. See if you can notice them becoming visible in
              someone.
            </p>
            <button
              type="button"
              onClick={() => noticeThisFormula(formula)}
              className="mt-3 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Notice an Unsung Hero
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Carries this formula's virtue names into Unsung Heroes' default recognition
// path -- same sessionStorage-handoff pattern already used for avaia:focus
// (Journey -> Chemistry of Virtue), just a separate key since the shape is
// different (a small set of virtues + an outcome, not one family/virtue).
// Read once and cleared on the Unsung Heroes side; nothing is sent to the AI.
function noticeThisFormula(formula: Formula) {
  const virtues = Array.from(
    new Set([formula.primaryVirtue, ...formula.supportingVirtues, ...formula.balancingVirtues])
  );
  try {
    sessionStorage.setItem(
      "avaia:formula-focus",
      JSON.stringify({ virtues, outcome: formula.desiredOutcome })
    );
  } catch {
    // Storage can be unavailable (private browsing) -- proceeding without the
    // reminder banner is a fine, harmless outcome.
  }
  window.location.href = "/unsung-heroes?path=i_saw_someone";
}
