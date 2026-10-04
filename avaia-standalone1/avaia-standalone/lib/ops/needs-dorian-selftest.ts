import "server-only";
import {
  buildCertificationOperationsRecords,
  EVIDENCE_TYPE_ORDER,
  type EvidenceType,
} from "@/lib/certification-operations";
import {
  assembleSnapshot,
  classifyCertificationRecords,
  snapshotToDigestSections,
  type NeedsItem,
} from "@/lib/ops/needs-dorian-core";
import { getCompanionCheckinSnapshot } from "@/lib/ops/certification-companion";
import type { CheckResult } from "@/lib/ops/system-checks";

// Part of the system checks (Move 1's runner): proves, with SIMULATED records
// only (nothing is read from or written to the database, no real person is
// involved), that the Needs-Dorian pipeline behaves the way it is supposed to.
// It exercises the very same functions production uses to decide what reaches
// Dorian, so if a future change quietly breaks one of these promises, the next
// scheduled check reports it instead of nobody noticing.
//
// Promises tested:
//   1. A condition that needs Dorian appears.
//   2. The Founder Digest and /admin/today receive the same items (one source).
//   3. Resolving the condition removes the item.
//   4. Routine, healthy activity produces nothing that needs Dorian.
//   5. One condition is reported exactly once, never twice.
//   6. A quiet candidate is visibility only, never a task.
//   7. Handoff steps get one shared grace period before they are raised.
// Plus: the candidate check-in support function still runs (it is only read,
// nothing is sent).

const DAY = 86_400_000;

function row(status: "pass" | "problem", checkKey: string, label: string, detail: string): CheckResult {
  return { category: "quality", checkKey, label, status, detail };
}

export async function pipelineChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const failures: string[] = [];
  const expect = (cond: boolean, message: string) => {
    if (!cond) failures.push(message);
  };

  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();
  const label = (id: string) => `candidate ${id}`;

  type Ev = { candidate_id: string; evidence_type: EvidenceType; rating: "competent" | "development_required" | "critical_fail"; recorded_by: string | null; recorded_at: string };
  const competent = (candidateId: string, types: readonly EvidenceType[], daysAgo = 1): Ev[] =>
    types.map((t) => ({ candidate_id: candidateId, evidence_type: t, rating: "competent", recorded_by: null, recorded_at: iso(daysAgo) }));

  const preGate: EvidenceType[] = [
    "candidate_agreement",
    "foundations_knowledge_check",
    "host_seat_experience",
    "table_building_exercise",
  ];

  const candidate = (id: string, admittedDaysAgo: number, flagged = false) => ({
    id,
    host_id: `host-${id}`,
    status: "in_training",
    admitted_at: iso(admittedDaysAgo),
    ready_for_review: flagged,
    ready_for_review_notes: null,
  });

  const run = (inputs: {
    candidates: ReturnType<typeof candidate>[];
    evidence?: Ev[];
    decisions?: { host_id: string; decision: "certified" | "development_required" | "not_currently_eligible"; decision_date: string }[];
    certifications?: { candidate_id: string; host_id: string; standing: "active"; certified_at: string }[];
    toolkitFor?: string[];
    testHosts?: string[];
  }) => {
    const records = buildCertificationOperationsRecords({
      candidates: inputs.candidates,
      evidenceRows: inputs.evidence ?? [],
      decisions: inputs.decisions ?? [],
      certifications: inputs.certifications ?? [],
      platformAuth: (inputs.toolkitFor ?? []).map((h) => ({
        host_id: h,
        capability: "toolkit" as const,
        status: "authorized" as const,
        granted_at: iso(30),
        status_changed_at: null,
      })),
      profiles: [],
      progressRows: [],
      curriculumCounts: { lessonsTotal: 83, labsTotal: 15 },
      historyLastActivity: new Map<string, string>(),
      designatedTestHostIds: new Set(inputs.testHosts ?? []),
      now,
    });
    return classifyCertificationRecords(records, label, now);
  };

  try {
    // 4. Routine healthy activity: a candidate admitted yesterday, nothing wrong.
    const routine = run({ candidates: [candidate("routine", 1)] });
    expect(routine.decisions.length === 0 && routine.problems.length === 0 && routine.watching.filter((w) => w.key.includes(":stale")).length === 0,
      "a healthy, recently admitted candidate produced an item");

    // 6. A quiet candidate is visibility only.
    const quiet = run({ candidates: [candidate("quiet", 30)] });
    expect(quiet.decisions.length === 0 && quiet.problems.length === 0, "a quiet candidate became a task");
    expect(quiet.watching.some((w) => w.key === "cert:quiet:stale"), "a quiet candidate was not even noted for visibility");

    // 1 + 5. Ready for the certification decision: complete portfolio AND the
    // 'ready' flag are two reasons for the same decision -> exactly one item.
    const portfolio = competent("ready", EVIDENCE_TYPE_ORDER);
    const ready = run({ candidates: [candidate("ready", 40, true)], evidence: portfolio });
    const readyItems = ready.decisions.filter((d) => d.key === "cert:ready:ready_for_review");
    expect(readyItems.length === 1, `a candidate ready for the decision should appear exactly once (saw ${readyItems.length})`);
    expect(ready.decisions.length === 1, "extra decision items appeared for a single ready candidate");

    // 3. Resolving removes it: a 'certified' decision, an active certification, Toolkit authorized.
    const resolved = run({
      candidates: [candidate("ready", 40, true)],
      evidence: portfolio,
      decisions: [{ host_id: "host-ready", decision: "certified", decision_date: iso(20) }],
      certifications: [{ candidate_id: "ready", host_id: "host-ready", standing: "active", certified_at: iso(19) }],
      toolkitFor: ["host-ready"],
    });
    expect(resolved.decisions.length === 0 && resolved.problems.length === 0, "a fully resolved candidate still produced an item");

    // 7. One shared grace period for handoff steps.
    const early = run({
      candidates: [candidate("grace", 40)],
      decisions: [{ host_id: "host-grace", decision: "certified", decision_date: iso(1) }],
    });
    expect(early.decisions.length === 0, "a certification decision one day old was raised before the grace period");
    const late = run({
      candidates: [candidate("grace", 40)],
      decisions: [{ host_id: "host-grace", decision: "certified", decision_date: iso(10) }],
    });
    expect(late.decisions.filter((d) => d.key === "cert:grace:missing_certification").length === 1, "an overdue missing certification record should appear exactly once");

    // Toolkit authorization pending: once, never twice.
    const activation = run({
      candidates: [candidate("auth", 40)],
      decisions: [{ host_id: "host-auth", decision: "certified", decision_date: iso(12) }],
      certifications: [{ candidate_id: "auth", host_id: "host-auth", standing: "active", certified_at: iso(10) }],
    });
    expect(activation.decisions.filter((d) => d.key === "cert:auth:activation_pending").length === 1 && activation.decisions.length === 1,
      "an overdue Toolkit authorization should appear exactly once");

    // Boundary Gate result not yet competent: one decision item (it used to be two exceptions).
    const gate = run({
      candidates: [candidate("gate", 40)],
      evidence: [
        ...competent("gate", preGate),
        { candidate_id: "gate", evidence_type: "boundary_gate", rating: "development_required", recorded_by: null, recorded_at: iso(2) },
      ],
    });
    expect(gate.decisions.length === 1 && gate.decisions[0].key === "cert:gate:gate_waiting", "a not-yet-competent Boundary Gate should be exactly one decision item");

    // Designated test account (active founder_test entitlement): a certification
    // with no decision on file is NOT flagged for it, and nothing else is hidden.
    const noDecisionCert = (id: string) => ({
      candidates: [candidate(id, 40)],
      certifications: [{ candidate_id: id, host_id: `host-${id}`, standing: "active" as const, certified_at: iso(10) }],
      toolkitFor: [`host-${id}`],
    });
    const realMismatch = run(noDecisionCert("real"));
    expect(realMismatch.problems.filter((p) => p.key === "cert:real:mismatch_no_decision").length === 1,
      "a REAL Guide with a certification but no decision must still be flagged");
    const testAccount = run({ ...noDecisionCert("testacct"), testHosts: ["host-testacct"] });
    expect(testAccount.problems.length === 0 && testAccount.decisions.length === 0,
      "the designated test account was flagged for a missing certification decision");
    expect(testAccount.watching.some((w) => w.key === "cert:testacct:test_account"),
      "the designated test account's exemption was not stated for visibility");
    // The exemption is narrow: a test account's other conditions are still raised.
    const testOverdue = run({
      candidates: [candidate("testlate", 40)],
      decisions: [{ host_id: "host-testlate", decision: "certified", decision_date: iso(10) }],
      testHosts: ["host-testlate"],
    });
    expect(testOverdue.decisions.filter((d) => d.key === "cert:testlate:missing_certification").length === 1,
      "the test-account exemption hid a different rule (missing certification record)");
    // A test designation on a different host exempts nobody else.
    const wrongHost = run({ ...noDecisionCert("other"), testHosts: ["host-someone-else"] });
    expect(wrongHost.problems.some((p) => p.key === "cert:other:mismatch_no_decision"),
      "exempting one account exempted another");

    // 5 (across everything): no two items anywhere share a key.
    const all = [...ready.decisions, ...late.decisions, ...activation.decisions, ...gate.decisions, ...quiet.watching, ...realMismatch.problems, ...testAccount.watching];
    expect(new Set(all.map((i) => i.key)).size === all.length, "two items shared the same identity");

    // 2. One source -> both views. Build a snapshot with something in every bucket.
    const item = (key: string): NeedsItem => ({ key, text: `simulated ${key}` });
    const snapshot = assembleSnapshot({
      people: [item("p1")],
      decisions: [...ready.decisions, item("d1")],
      approvals: [item("a1")],
      problems: [item("x1")],
      opportunities: [item("o1")],
      watching: [item("w1")],
    });
    const digest = snapshotToDigestSections(snapshot);
    const needsInSnapshot = [
      ...snapshot.problems.items,
      ...snapshot.decisions.items,
      ...snapshot.people.items,
      ...snapshot.approvals.items,
    ].map((i) => i.text);
    expect(digest.needsDorian.length === snapshot.totalNeeded, "the digest and the live page count different numbers of needs");
    expect(needsInSnapshot.every((t) => digest.needsDorian.includes(t)), "an item on the live page is missing from the digest");
    expect(digest.waiting.length === snapshot.watching.count && !digest.needsDorian.includes("simulated w1"), "visibility items leaked into the needs list");
    expect(digest.opportunities.includes("simulated o1") && !digest.needsDorian.includes("simulated o1"), "opportunities were counted as tasks");

    results.push(
      failures.length === 0
        ? row("pass", "pipeline_needs_dorian", "The Needs-Dorian pipeline behaves as designed", "Simulated records confirm: a real need appears once and in both the daily email and the live page; resolving it removes it; routine activity and quiet candidates never become tasks; handoff steps wait out one shared grace period.")
        : row("problem", "pipeline_needs_dorian", "The Needs-Dorian pipeline behaves as designed", `${failures.length} promise(s) broken: ${failures.join("; ")}.`)
    );
  } catch (e) {
    results.push(row("problem", "pipeline_needs_dorian", "The Needs-Dorian pipeline behaves as designed", `The self-test could not run: ${e instanceof Error ? e.message : String(e)}.`));
  }

  // Candidate support (check-ins) is separate from monitoring and must keep working.
  try {
    const { waiting } = await getCompanionCheckinSnapshot();
    results.push(row("pass", "pipeline_checkins_ready", "Candidate check-ins are ready to run", `The check-in lookup works (${waiting.length} candidate(s) currently quiet enough for a gentle note). Nothing was sent.`));
  } catch (e) {
    results.push(row("problem", "pipeline_checkins_ready", "Candidate check-ins are ready to run", `The check-in lookup failed: ${e instanceof Error ? e.message : String(e)}.`));
  }

  return results;
}
