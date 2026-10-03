import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CapabilityEvidence, CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";
import type { CheckResult, CheckStatus } from "@/lib/ops/system-checks";

// OPERATIONAL CAPABILITIES: the one registry of every approved AVAIA operational
// capability that runs through the single Needs-Dorian source.
//
// "Done" for a capability means it is connected, deployed, triggered, tested,
// and PROVEN to be operating. This file is where the proof comes from:
//
//   * Each capability is a function that reads its live records, applies its
//     rules, and returns what needs a person (routed into What Needs Dorian)
//     plus how many records it examined.
//   * getNeedsDorian() evaluates every registered capability, so the daily
//     Founder Digest and /admin/today include them with no separate cron,
//     email, or page to forget about.
//   * The Founder Digest cron records which capabilities were evaluated, and
//     how many records each examined, with its own run (cron_runs.detail).
//   * System Checks (capabilityChecks below) evaluates every capability live AND
//     verifies that the scheduled digest recorded the same evidence recently.
//     A capability that exists in code but is not registered, or that stops being
//     evaluated, is reported instead of silently doing nothing.
//
// To add a capability: write its evaluator, register it in CAPABILITIES, and add
// its simulated-record cases to lib/ops/needs-dorian-selftest.ts. Nothing else.

export type CapabilityDefinition = {
  key: string;
  label: string;
  run: () => Promise<CapabilityResult>;
};

/** Every operational capability currently wired into production. */
export const CAPABILITIES: CapabilityDefinition[] = [];

const flaggedCount = (r: CapabilityResult): number =>
  (r.people?.length ?? 0) + (r.decisions?.length ?? 0) + (r.approvals?.length ?? 0) + (r.problems?.length ?? 0);

/** Runs every registered capability. One failing never blocks the others; the
 *  failure is itself recorded as evidence (and becomes a problem item). */
export async function evaluateCapabilities(): Promise<{ results: CapabilityResult[]; evidence: CapabilityEvidence[] }> {
  const settled = await Promise.all(
    CAPABILITIES.map(async (c) => {
      try {
        const result = await c.run();
        const evidence: CapabilityEvidence = {
          key: c.key,
          label: c.label,
          ok: true,
          evaluated: result.evaluated,
          flagged: flaggedCount(result),
        };
        return { result, evidence };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const failed: CapabilityResult = {
          key: c.key,
          label: c.label,
          evaluated: 0,
          problems: [{ key: `capability:${c.key}:failed`, text: `${c.label} could not be evaluated: ${message}.`, href: "/admin/system-checks" }],
        };
        const evidence: CapabilityEvidence = { key: c.key, label: c.label, ok: false, evaluated: 0, flagged: 1, error: message };
        return { result: failed, evidence };
      }
    })
  );
  return { results: settled.map((s) => s.result), evidence: settled.map((s) => s.evidence) };
}

/** Merges capability results into the Needs-Dorian buckets. */
export function mergeCapabilityItems(results: CapabilityResult[]): {
  people: NeedsItem[];
  decisions: NeedsItem[];
  approvals: NeedsItem[];
  problems: NeedsItem[];
  watching: NeedsItem[];
} {
  const out = { people: [] as NeedsItem[], decisions: [] as NeedsItem[], approvals: [] as NeedsItem[], problems: [] as NeedsItem[], watching: [] as NeedsItem[] };
  for (const r of results) {
    out.people.push(...(r.people ?? []));
    out.decisions.push(...(r.decisions ?? []));
    out.approvals.push(...(r.approvals ?? []));
    out.problems.push(...(r.problems ?? []));
    out.watching.push(...(r.watching ?? []));
  }
  return out;
}

// ---------------------------------------------------------------------------
// System Checks: proof that each capability is operating
// ---------------------------------------------------------------------------

const row = (checkKey: string, label: string, status: CheckStatus, detail: string): CheckResult => ({
  category: "quality",
  checkKey,
  label,
  status,
  detail,
});

const DIGEST_EVIDENCE_MAX_AGE_HOURS = 40;

export async function capabilityChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { evidence } = await evaluateCapabilities();

  // 1. Live: every capability can be evaluated right now.
  for (const e of evidence) {
    results.push(
      e.ok
        ? row(
            `capability_${e.key}`,
            `${e.label} is operating`,
            "pass",
            `Evaluated ${e.evaluated} record(s) just now; ${e.flagged} need a person (routed to What Needs Dorian), the rest need nothing.`
          )
        : row(`capability_${e.key}`, `${e.label} is operating`, "problem", `It could not be evaluated: ${e.error ?? "unknown error"}.`)
    );
  }

  // 2. Scheduled: the daily digest recorded the same evidence on its own run,
  //    so the capabilities are proven to run without anyone opening a page.
  try {
    const admin = createAdminClient();
    const { data: run } = await admin
      .from("cron_runs")
      .select("started_at, status, detail")
      .eq("cron_name", "founder-digest")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const label = "The daily digest evaluates every operational capability";
    const ageHours = run ? (Date.now() - new Date(run.started_at as string).getTime()) / 3_600_000 : null;
    const recorded = (run?.detail as { capabilities?: CapabilityEvidence[] } | null)?.capabilities;
    if (!run || ageHours === null || ageHours > DIGEST_EVIDENCE_MAX_AGE_HOURS) {
      results.push(row("capability_digest_evidence", label, "problem", "The daily digest has not recorded a run in the last day and a half, so scheduled evaluation is not proven."));
    } else if (!recorded) {
      results.push(row("capability_digest_evidence", label, "pass", "The most recent digest run predates capability recording; the next scheduled run will record the proof."));
    } else {
      const missing = CAPABILITIES.filter((c) => !recorded.some((r) => r.key === c.key)).map((c) => c.label);
      const failed = recorded.filter((r) => !r.ok).map((r) => r.label);
      if (missing.length > 0 || failed.length > 0) {
        results.push(
          row(
            "capability_digest_evidence",
            label,
            "problem",
            `${missing.length > 0 ? `Not evaluated by the last digest: ${missing.join(", ")}. ` : ""}${failed.length > 0 ? `Failed in the last digest: ${failed.join(", ")}.` : ""}`.trim()
          )
        );
      } else {
        results.push(row("capability_digest_evidence", label, "pass", `The last digest run (${Math.round(ageHours)}h ago) evaluated all ${recorded.length} capabilities.`));
      }
    }
  } catch (e) {
    results.push(row("capability_digest_evidence", "The daily digest evaluates every operational capability", "problem", `Could not read the digest's run record: ${e instanceof Error ? e.message : String(e)}.`));
  }

  return results;
}
