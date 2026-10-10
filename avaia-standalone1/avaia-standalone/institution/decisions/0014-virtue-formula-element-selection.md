# Decision 0014 — Virtue Formula: how elements are suggested and chosen

**Status:** Recorded, governing. Founder decision, 2026-10-10. Closes the open question carried since Decision 0007.

## The rule

AVAIA may suggest virtue elements only when the Host's own words support them. The Host decides which elements belong, which one is Primary,
and which, if any, are Supporting or Balancing toward the Host's Desired Outcome.

## What follows

* A suggestion is shown only if it names a real Chemistry of Virtue element **and** quotes words that are actually in what the Host wrote.
  Enforced in code (`lib/virtue-formula.ts`), not left to a prompt.
* A suggestion carries no role. Primary, Supporting and Balancing are assigned only by the Host.
* There is no fixed number of Supporting or Balancing elements. The earlier "1–3 Supporting, 1–2 Balancing" counts were not source-governed and are gone.
* No mechanical pairing of elements (no "opposite of the problem"). No AI declaration that an element belongs.
* The Host confirms the final formula, with exactly one Primary. The Desired Outcome is the Host's own words, unchanged.
* The Host may also add any of the 123 elements themselves.
* Nothing is saved by the public Chemistry page.

## Where it lives

`lib/virtue-formula.ts` (rule and validation), `app/api/chemistry/virtue-formula/route.ts` (suggestions only),
`components/VirtueFormulaGenerator.tsx` (the Host's choices). Protected by cases in `lib/ops/reconciliation-selftests.ts`.
