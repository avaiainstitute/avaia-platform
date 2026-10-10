import { VIRTUES } from "@/lib/virtues";

// THE VIRTUE FORMULA RULE (Founder decision, 2026-10-10):
//
//   AVAIA may suggest virtue elements only when the Host's own words support them. The Host decides which elements belong, which one is
//   Primary, and which, if any, are Supporting or Balancing toward the Host's Desired Outcome.
//
// What follows from it, and is enforced here rather than left to a prompt:
//   * a suggestion survives only if it names a real element AND quotes words that are actually in what the Host wrote;
//   * a suggestion carries no role: Primary / Supporting / Balancing are assigned only by the Host;
//   * there is no fixed number of Supporting or Balancing elements, and no mechanical pairing of one element with another;
//   * the final formula exists only when the Host confirms it, with exactly one Primary chosen by the Host.

export type FormulaSuggestion = { element: string; theirWords: string };
export type FormulaRole = "primary" | "supporting" | "balancing";
export type FormulaPick = { element: string; role: FormulaRole };
export type ConfirmedFormula = {
  primaryVirtue: string;
  supportingVirtues: string[];
  balancingVirtues: string[];
  desiredOutcome: string;
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** The real element name for a supplied name (case-insensitive), or null if it is not one of the 123. */
export function realElementName(name: string): string | null {
  const key = name.trim().toLowerCase();
  return VIRTUES.find((v) => v.name.toLowerCase() === key)?.name ?? null;
}

/** Keeps only suggestions that name a real element and quote words genuinely present in the Host's own description. Anything else is
 *  dropped, never shown. Duplicates are collapsed. Roles are never read from the model's output. */
export function supportedSuggestions(description: string, raw: unknown): FormulaSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const own = normalize(description);
  const seen = new Set<string>();
  const out: FormulaSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const element = typeof (item as any).element === "string" ? realElementName((item as any).element) : null;
    const words = typeof (item as any).theirWords === "string" ? (item as any).theirWords.trim() : "";
    if (!element || seen.has(element) || words.length < 2) continue;
    if (!own.includes(normalize(words))) continue;
    seen.add(element);
    out.push({ element, theirWords: words });
  }
  return out;
}

/** Builds the formula from the Host's own choices. Fails unless the Host has chosen exactly one Primary and every element is real and
 *  used once. Supporting and Balancing may be empty or any length: the Host decides. */
export function buildConfirmedFormula(
  desiredOutcome: string,
  picks: FormulaPick[]
): { ok: true; formula: ConfirmedFormula } | { ok: false; reason: string } {
  const outcome = desiredOutcome.trim();
  if (!outcome) return { ok: false, reason: "Name your desired outcome first." };
  const names = picks.map((p) => realElementName(p.element));
  if (names.some((n) => n === null)) return { ok: false, reason: "Every element must be one of the real Chemistry of Virtue elements." };
  if (new Set(names).size !== names.length) return { ok: false, reason: "Each element can be used once." };
  const primaries = picks.filter((p) => p.role === "primary");
  if (primaries.length !== 1) return { ok: false, reason: "Choose exactly one element as your Primary." };
  const pick = (role: FormulaRole) => picks.filter((p) => p.role === role).map((p) => realElementName(p.element) as string);
  return {
    ok: true,
    formula: {
      primaryVirtue: pick("primary")[0],
      supportingVirtues: pick("supporting"),
      balancingVirtues: pick("balancing"),
      desiredOutcome: outcome,
    },
  };
}
