"use client";

import { useState } from "react";
import { VIRTUES, VIRTUE_FAMILIES, familyOf } from "@/lib/virtues";
import {
  buildConfirmedFormula,
  type ConfirmedFormula,
  type FormulaRole,
  type FormulaSuggestion,
} from "@/lib/virtue-formula";

type Formula = ConfirmedFormula;
type RoleChoice = FormulaRole | "";

const ROLE_LABEL: Record<RoleChoice, string> = {
  "": "Not part of my formula",
  primary: "Primary",
  supporting: "Supporting",
  balancing: "Balancing",
};

function familyColorFor(name: string): string {
  const v = VIRTUES.find((x) => x.name === name);
  return v ? familyOf(v.family).color : "#9aa4b2";
}

function VirtuePill({ name, onClick }: { name: string; onClick?: () => void }) {
  const style = { backgroundColor: familyColorFor(name) };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-block rounded-full px-3 py-1 text-sm text-white transition-opacity hover:opacity-80"
        style={style}
      >
        {name}
      </button>
    );
  }
  return (
    <span className="inline-block rounded-full px-3 py-1 text-sm text-white" style={style}>
      {name}
    </span>
  );
}

/** You describe your Desired Outcome in your own words. AVAIA may point to real Chemistry of Virtue elements ONLY where your own words
 *  support them, and shows the words it is pointing to. You decide which elements belong, which one is Primary, and which, if any, are
 *  Supporting or Balancing. The formula exists only when you confirm it. See lib/virtue-formula.ts for the rule and the route's own
 *  comments for how every suggestion is checked against the real table and against what you wrote.
 *
 *  onSelectVirtue, if given, makes each pill clickable, it reuses the
 *  Chemistry page's own existing detail-panel state (see selectByName in
 *  app/chemistry/page.tsx) rather than building a second definition view. */
export default function VirtueFormulaGenerator({
  onSelectVirtue,
}: {
  onSelectVirtue?: (name: string) => void;
}) {
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [suggestions, setSuggestions] = useState<FormulaSuggestion[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, RoleChoice>>({});
  const [toAdd, setToAdd] = useState("");
  const [formula, setFormula] = useState<Formula | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function lookForElements(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || loading) return;
    setLoading(true);
    setError("");
    setFormula(null);
    setSuggestions(null);
    setAdded([]);
    setRoles({});
    try {
      const res = await fetch("/api/chemistry/virtue-formula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not look for elements in your words.");
      setOutcome(data.desiredOutcome);
      setSuggestions(data.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const chosen = [...(suggestions ?? []).map((s) => s.element), ...added];

  function addElement() {
    if (!toAdd || chosen.includes(toAdd)) return;
    setAdded((a) => [...a, toAdd]);
    setToAdd("");
  }

  function confirmFormula() {
    setError("");
    const picks = chosen
      .filter((n) => roles[n])
      .map((n) => ({ element: n, role: roles[n] as FormulaRole }));
    const built = buildConfirmedFormula(outcome, picks);
    if (!built.ok) {
      setError(built.reason);
      return;
    }
    setFormula(built.formula);
  }

  return (
    <div>
      <form onSubmit={lookForElements} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Your desired outcome, e.g. &ldquo;being a present dad&rdquo;"
          maxLength={600}
          className="flex-1 rounded-md border border-rule bg-white/[0.04] px-4 py-2.5 text-ink outline-none backdrop-blur-sm placeholder:text-muted focus:border-seal"
        />
        <button
          type="submit"
          disabled={!description.trim() || loading}
          className="shrink-0 rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Working…" : "Look for elements in my words"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-[#e0857d]">{error}</p>}

      {suggestions && !formula && (
        <div className="mt-6 space-y-5 rounded-lg border border-dashed border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-5">
          <div>
            <p className="label mb-1 text-muted">Your desired outcome</p>
            <p className="font-serif text-lg text-ink">{outcome}</p>
          </div>

          <p className="text-sm text-muted">
            {suggestions.length > 0
              ? "These elements are possibilities your own words may point toward. You decide which belong in your formula, which one is Primary, and which, if any, are Supporting or Balancing."
              : "Your words did not point clearly to any element yet. You can add elements yourself below."}
          </p>

          {chosen.length > 0 && (
            <ul className="space-y-3">
              {chosen.map((name) => {
                const s = suggestions.find((x) => x.element === name);
                return (
                  <li key={name} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <VirtuePill name={name} onClick={onSelectVirtue ? () => onSelectVirtue(name) : undefined} />
                      <p className="mt-1 text-sm text-muted">
                        {s ? <>Your words: &ldquo;{s.theirWords}&rdquo;</> : "Added by you"}
                      </p>
                    </div>
                    <label className="text-sm text-ink">
                      <span className="sr-only">Role of {name} in your formula</span>
                      <select
                        value={roles[name] ?? ""}
                        onChange={(e) => setRoles((r) => ({ ...r, [name]: e.target.value as RoleChoice }))}
                        className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-ink outline-none focus:border-seal"
                      >
                        {(Object.keys(ROLE_LABEL) as RoleChoice[]).map((r) => (
                          <option key={r || "none"} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-2 border-t border-rule pt-4 sm:flex-row sm:items-center">
            <label className="text-sm text-muted" htmlFor="formula-add">
              Add an element yourself
            </label>
            <select
              id="formula-add"
              value={toAdd}
              onChange={(e) => setToAdd(e.target.value)}
              className="rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-ink outline-none focus:border-seal"
            >
              <option value="">Choose an element</option>
              {VIRTUE_FAMILIES.map((f) => (
                <optgroup key={f.key} label={f.name}>
                  {VIRTUES.filter((v) => v.family === f.key && !chosen.includes(v.name)).map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={addElement}
              disabled={!toAdd}
              className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div className="border-t border-rule pt-4">
            <button
              type="button"
              onClick={confirmFormula}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Confirm my formula
            </button>
            <p className="mt-2 text-sm text-muted">Choose exactly one Primary. Supporting and Balancing are yours to include or leave out.</p>
          </div>
        </div>
      )}

      {formula && (
        <div className="mt-6 space-y-4 rounded-lg border border-dashed border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-5">
          <div>
            <p className="label mb-2 text-muted">Primary</p>
            <VirtuePill
              name={formula.primaryVirtue}
              onClick={onSelectVirtue ? () => onSelectVirtue(formula.primaryVirtue) : undefined}
            />
          </div>
          {formula.supportingVirtues.length > 0 && (
            <div>
              <p className="label mb-2 text-muted">Supporting</p>
              <div className="flex flex-wrap gap-2">
                {formula.supportingVirtues.map((n) => (
                  <VirtuePill key={n} name={n} onClick={onSelectVirtue ? () => onSelectVirtue(n) : undefined} />
                ))}
              </div>
            </div>
          )}
          {formula.balancingVirtues.length > 0 && (
            <div>
              <p className="label mb-2 text-muted">Balancing</p>
              <div className="flex flex-wrap gap-2">
                {formula.balancingVirtues.map((n) => (
                  <VirtuePill key={n} name={n} onClick={onSelectVirtue ? () => onSelectVirtue(n) : undefined} />
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-rule pt-4">
            <p className="label mb-1 text-muted">Your desired outcome</p>
            <p className="font-serif text-lg text-ink">{formula.desiredOutcome}</p>
          </div>
          <div className="border-t border-rule pt-4">
            <p className="text-ink">
              This is your formula, confirmed by you. These virtue elements are already within you, within whatever capacity you have right
              now. You can also notice them becoming visible in someone else.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => noticeThisFormula(formula)}
                className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
              >
                Notice an Unsung Hero
              </button>
              <button
                type="button"
                onClick={() => setFormula(null)}
                className="inline-block rounded-md border border-rule px-5 py-2.5 text-sm text-ink transition-colors hover:border-seal"
              >
                Change my formula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Carries this formula's virtue names into Unsung Heroes' default recognition
// path, same sessionStorage-handoff pattern already used for avaia:focus
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
    // Storage can be unavailable (private browsing), proceeding without the
    // reminder banner is a fine, harmless outcome.
  }
  window.location.href = "/unsung-heroes?path=i_saw_someone";
}
