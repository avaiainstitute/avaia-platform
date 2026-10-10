import "server-only";
import { DEFYING_GRIEF_THREADS, formatDefyingGriefThreadsHierarchy } from "@/lib/defying-grief-threads";
import { formatSecondaryLossClassifications } from "@/lib/engine/referral-provenance";
import { LEGACY_SECONDARY_LOSS_NAMES, SECONDARY_LOSSES, canonicalSecondaryLoss, isValidSecondaryLoss, secondaryLossLabel } from "@/lib/institution";
import { VIEW_FROM_ABOVE_CLASSES, viewFromAboveStoredTitles, viewFromAboveTitleMatches } from "@/lib/view-from-above";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TEST FOR THE TEN SECONDARY LOSS NAMES. Simulated values only: nothing is read from or written to the database.
//
//   * the canonical list is exactly the ten names the Founder has decided (the loss once called "Decision-Making / Boundaries" is "Loss of Capacity");
//   * a stored value that still carries the retired name is recognized as the current name when READ, but is never accepted as a newly
//     generated category;
//   * every place keyed by the loss names (Defying Grief's four-thread table, the View From Above classes) uses exactly the canonical names;
//   * a View From Above class is still found in stored content under either its current or its retired title.

type Case = { name: string; ok: boolean };

const CANONICAL = ["Meaning", "Reality", "Dreams / Opportunities", "Self-Trust", "Loss of Capacity", "Life's Vision", "Connection", "Control", "Identity", "Attachment / Support"];

function secondaryLossNamesCheck(): CheckResult {
  const key = "pipeline_secondary_loss_names";
  const label = "The ten Secondary Loss names are reconciled";
  try {
    const cases: Case[] = [];
    cases.push({ name: "the canonical list is not exactly the ten decided names", ok: SECONDARY_LOSSES.map((s) => s.loss).join("|") === CANONICAL.join("|") });
    cases.push({
      name: "the retired name was not recognized as Loss of Capacity when read",
      ok: canonicalSecondaryLoss("Decision-Making / Boundaries") === "Loss of Capacity" && canonicalSecondaryLoss(" decision-making/boundaries ") === "Loss of Capacity",
    });
    cases.push({
      name: "a newly generated category was allowed to use the retired name",
      ok: !isValidSecondaryLoss("Decision-Making / Boundaries") && isValidSecondaryLoss("Loss of Capacity") && !isValidSecondaryLoss("Capacity"),
    });
    cases.push({
      name: "a current name changed when read, or an unknown name was accepted",
      ok: CANONICAL.every((n) => canonicalSecondaryLoss(n) === n) && canonicalSecondaryLoss("Loss of Imagination") === null && canonicalSecondaryLoss("") === null,
    });
    cases.push({ name: "the only retired names are the two spellings of the old Loss of Capacity name", ok: Object.values(LEGACY_SECONDARY_LOSS_NAMES).every((v) => v === "Loss of Capacity") && Object.keys(LEGACY_SECONDARY_LOSS_NAMES).length === 2 });
    cases.push({
      name: "a Secondary Loss label doubled its prefix, or dropped it",
      ok:
        secondaryLossLabel("Loss of Capacity") === "Loss of Capacity" &&
        secondaryLossLabel("Control") === "Loss of Control" &&
        !formatDefyingGriefThreadsHierarchy().includes("Loss of Loss of") &&
        formatDefyingGriefThreadsHierarchy().includes("Loss of Capacity:"),
    });

    const shown = formatSecondaryLossClassifications([
      { category: "Decision-Making / Boundaries", description: "Hard to carry it all." },
      "decision-making/boundaries",
      { category: "Control", description: null },
    ]);
    cases.push({ name: "a stored referral with the retired name did not read as Loss of Capacity", ok: shown.join("|") === "Loss of Capacity, Hard to carry it all.|Loss of Capacity|Control" });

    cases.push({
      name: "Defying Grief's four-thread table is not keyed by exactly the canonical names",
      ok: Object.keys(DEFYING_GRIEF_THREADS).slice().sort().join("|") === CANONICAL.slice().sort().join("|"),
    });
    cases.push({
      name: "a View From Above class names a Secondary Loss that is not canonical",
      ok: VIEW_FROM_ABOVE_CLASSES.every((c) => CANONICAL.includes(c.secondaryLoss)),
    });
    const capacityClass = VIEW_FROM_ABOVE_CLASSES.find((c) => c.secondaryLoss === "Loss of Capacity");
    cases.push({
      name: "the Loss of Capacity class is not found under both its current and its retired title",
      ok:
        !!capacityClass &&
        capacityClass.title === "The Loss of Capacity" &&
        viewFromAboveTitleMatches(capacityClass, "The Loss of Capacity") &&
        viewFromAboveTitleMatches(capacityClass, "The Loss of Decision-Making / Boundaries") &&
        viewFromAboveStoredTitles(capacityClass).length === 2,
    });

    const failed = cases.filter((c) => !c.ok).map((c) => c.name);
    return failed.length === 0
      ? {
          category: "quality",
          checkKey: key,
          label,
          status: "pass",
          detail:
            "Simulated values confirm: the canonical list is the ten decided names with the loss once called Decision-Making / Boundaries now named Loss of Capacity; a stored value with the retired name reads as Loss of Capacity but is never accepted as a newly generated category; Defying Grief's thread table and every View From Above class use exactly the canonical names; and the Capacity class is still found in stored content under either its current or its retired title.",
        }
      : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

export function secondaryLossNamesChecks(): CheckResult[] {
  return [secondaryLossNamesCheck()];
}
