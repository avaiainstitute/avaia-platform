import "server-only";
import { buildGuideOperationsRecords, type RawGuideRow } from "@/lib/guide-operations";
import { classifyGuideOperations } from "@/lib/ops/guide-access-operations";
import type { CheckResult } from "@/lib/ops/system-checks";

// SELF-TESTS FOR THE OPERATIONAL CAPABILITIES. Like needs-dorian-selftest.ts,
// these use SIMULATED records only (nothing is read from or written to the
// database; no real person is involved). Each capability's real rules are run
// on made-up cases, so if a future change quietly breaks one, the next scheduled
// system check reports it. Keys use the pipeline_ prefix, so they appear in the
// "Needs Dorian: does the pipeline behave as designed?" section.

type Case = { name: string; ok: boolean };

function result(key: string, label: string, passDetail: string, cases: Case[]): CheckResult {
  const failed = cases.filter((c) => !c.ok).map((c) => c.name);
  return failed.length === 0
    ? { category: "quality", checkKey: key, label, status: "pass", detail: passDetail }
    : { category: "quality", checkKey: key, label, status: "problem", detail: `${failed.length} case(s) broke: ${failed.join("; ")}.` };
}

function attempt(key: string, label: string, run: () => CheckResult): CheckResult {
  try {
    return run();
  } catch (e) {
    return { category: "quality", checkKey: key, label, status: "problem", detail: `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.` };
  }
}

const label = (id: string) => `host ${id}`;

// ---------------------------------------------------------------------------
// Guide Operations
// ---------------------------------------------------------------------------

function guideOperationsCheck(): CheckResult {
  return attempt("pipeline_guide_operations", "Guide Operations behaves as designed", () => {
    const base: RawGuideRow = {
      hostId: "g",
      profileRole: "member",
      certificationStanding: "active",
      certifiedAt: "2026-01-01T00:00:00Z",
      toolkitAuthorized: true,
      journeyFacilitationAuthorized: true,
      activeHostScopedAccessCount: 2,
    };
    const run = (rows: Partial<RawGuideRow>[]) =>
      classifyGuideOperations(buildGuideOperationsRecords(rows.map((r, i) => ({ ...base, hostId: `h${i}`, ...r }))), label);
    const cases: Case[] = [];

    // A healthy certified Guide (a 'member' role is fine: access follows certification) is never flagged.
    const healthy = run([{}]);
    cases.push({ name: "a healthy certified Guide was flagged", ok: (healthy.problems?.length ?? 0) === 0 });
    cases.push({ name: "the record was not counted as examined", ok: healthy.evaluated === 1 });

    // A role label with no active certification is real access through older rules.
    const roleOnly = run([{ certificationStanding: null, profileRole: "guide", toolkitAuthorized: false, journeyFacilitationAuthorized: false, activeHostScopedAccessCount: 0 }]);
    cases.push({ name: "a 'guide' role with no certification was not flagged", ok: (roleOnly.problems?.length ?? 0) === 1 });

    // Paused / revoked standing with live authorizations and Host access.
    const paused = run([{ certificationStanding: "paused" }]);
    cases.push({ name: "a paused Guide with live Toolkit, Journey and Host access did not raise 3 items", ok: (paused.problems?.length ?? 0) === 3 });
    const revoked = run([{ certificationStanding: "revoked", toolkitAuthorized: true, journeyFacilitationAuthorized: false, activeHostScopedAccessCount: 0 }]);
    cases.push({ name: "a revoked Guide with a live Toolkit authorization was not flagged", ok: (revoked.problems?.length ?? 0) === 1 });

    // A lapsed (inactive) certification deliberately keeps its records: expected, never flagged.
    const inactive = run([{ certificationStanding: "inactive" }]);
    cases.push({ name: "an inactive (lapsed) Guide's preserved records were flagged", ok: (inactive.problems?.length ?? 0) === 0 });
    // ...but a 'guide' role label surviving a lapse is still access through older rules.
    const inactiveRole = run([{ certificationStanding: "inactive", profileRole: "guide" }]);
    cases.push({ name: "a lapsed Guide who still has the 'guide' role was not flagged", ok: (inactiveRole.problems?.length ?? 0) === 1 });

    // Authorization with no certification at all.
    const noCert = run([{ certificationStanding: null, toolkitAuthorized: true, journeyFacilitationAuthorized: false, activeHostScopedAccessCount: 0 }]);
    cases.push({ name: "a Toolkit authorization with no certification was not flagged", ok: (noCert.problems?.length ?? 0) === 1 });

    // Everyone with no Guide footprint is simply not a record (handled by the loader), and a
    // 'member' with nothing is "not certified", never a mismatch.
    const nothing = run([{ certificationStanding: null, toolkitAuthorized: false, journeyFacilitationAuthorized: false, activeHostScopedAccessCount: 0 }]);
    cases.push({ name: "an account with no Guide access at all was flagged", ok: (nothing.problems?.length ?? 0) === 0 });

    // Every item points where Dorian can act and is unique.
    const all = [...(paused.problems ?? []), ...(roleOnly.problems ?? [])];
    cases.push({ name: "items were not unique", ok: new Set(all.map((i) => i.key)).size === all.length });
    cases.push({ name: "an item has no place to act", ok: all.every((i) => !!i.href) });

    return result(
      "pipeline_guide_operations",
      "Guide Operations behaves as designed",
      "Simulated Guides confirm: a healthy certified Guide is never flagged; a 'guide' role without an active certification, and live access under a paused, revoked or absent certification, are each reported once; a lapsed certification's preserved records are not.",
      cases
    );
  });
}

export function capabilityRuleChecks(): CheckResult[] {
  return [guideOperationsCheck()];
}
