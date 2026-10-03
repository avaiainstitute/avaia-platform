import "server-only";
import { buildGuideOperationsRecords, type RawGuideRow } from "@/lib/guide-operations";
import { classifyGuideOperations } from "@/lib/ops/guide-access-operations";
import {
  deriveGuideParticipantState,
  deriveHostJourneyState,
  type GuideParticipantRecord,
  type HostConversationRow,
  type HostJourneyRecord,
} from "@/lib/host-operations";
import { classifyHostParticipantOperations, classifyHostScopedAccess } from "@/lib/ops/host-participant-operations";
import { buildOrganizationRecords, type OrganizationAdminStatus, type RawOrganizationRow } from "@/lib/organization-operations";
import { classifyOrganizations } from "@/lib/ops/organization-operations";
import { answerRoutineToolkitQuestion, checkToolkitRegistryHealth, requiresHumanApproval, type ToolkitSupportItem } from "@/lib/toolkit-stewardship";
import { classifyToolkitStewardship } from "@/lib/ops/toolkit-stewardship";
import type { IntegrityFlag } from "@/lib/conversation-integrity";
import { classifyConversationIntegrity, flagsForReply } from "@/lib/ops/conversation-integrity";
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

// ---------------------------------------------------------------------------
// Host / Participant Operations
// ---------------------------------------------------------------------------

function hostParticipantCheck(): CheckResult {
  return attempt("pipeline_host_participant_operations", "Host / Participant Operations behaves as designed", () => {
    const cases: Case[] = [];
    const t = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString();
    const convo = (id: string, stage: HostConversationRow["stage"], status: HostConversationRow["status"], day: number, journey: string | null = "j1"): HostConversationRow => ({
      id,
      stage,
      status,
      created_at: t(day),
      journey_id: journey,
    });
    const host = (hostId: string, conversations: HostConversationRow[], isMember: boolean): HostJourneyRecord => {
      const d = deriveHostJourneyState({ conversations, engagedConversationIds: new Set(conversations.map((c) => c.id)), isMember });
      return { hostId, isMember, ...d };
    };

    // Healthy: IAP complete, CAT active, a member.
    const healthy = host("healthy", [convo("a", "iap", "complete", 1), convo("b", "cat", "active", 2)], true);
    cases.push({ name: "a healthy Host in CAT was flagged", ok: healthy.mismatches.length === 0 && healthy.state === "cat_in_progress" });

    // Two active conversations at once.
    const multi = host("multi", [convo("a", "iap", "active", 1, "j1"), convo("b", "iap", "active", 2, "j2")], false);
    cases.push({ name: "two active conversations were not detected", ok: multi.mismatches.some((m) => m.type === "multiple_active_conversations") });

    // A completed stage with no next stage (production heals this when the Host returns).
    const stranded = host("stranded", [convo("a", "iap", "complete", 1)], false);
    cases.push({ name: "a completed stage with no next stage was not detected", ok: stranded.mismatches.some((m) => m.type === "stage_complete_handoff_missing") });
    // ...but a finished Journey is never a mismatch.
    const finished = host("finished", [convo("a", "iap", "complete", 1), convo("b", "cat", "complete", 2), convo("c", "innercompass", "complete", 3)], true);
    cases.push({ name: "a finished Journey was flagged", ok: finished.mismatches.length === 0 && finished.state === "journey_complete" });

    // Free stage done, waiting at the membership gate.
    const gated = host("gated", [convo("a", "iap", "complete", 1), convo("b", "cat", "active", 2)], false);
    cases.push({ name: "a non-member waiting at the membership gate was not recognized", ok: gated.state === "continuation_blocked_by_entitlement" });

    // Participants.
    const sess = (id: string, status: "active" | "complete", conversationId: string | null, day: number) => ({ id, tool: "iap", status, conversation_id: conversationId, created_at: t(day) });
    cases.push({ name: "a participant with no session was not 'ready'", ok: deriveGuideParticipantState({ sessions: [], nextConversationAwaitingSession: false }).state === "ready_for_session" });
    cases.push({ name: "an active session was not 'in progress'", ok: deriveGuideParticipantState({ sessions: [sess("s", "active", "c", 1)], nextConversationAwaitingSession: false }).state === "session_in_progress" });
    cases.push({
      name: "a finished session with the next stage already created was not 'follow-up available'",
      ok: deriveGuideParticipantState({ sessions: [sess("s", "complete", "c", 1)], nextConversationAwaitingSession: true }).state === "follow_up_available",
    });
    const brokenParticipant = deriveGuideParticipantState({ sessions: [sess("s", "complete", null, 1)], nextConversationAwaitingSession: false });
    cases.push({ name: "a complete session with no conversation was not a mismatch", ok: brokenParticipant.state === "operational_mismatch" });

    // Host-scoped Guide access.
    const access = classifyHostScopedAccess(
      [{ guide_id: "ok" }, { guide_id: "lapsed" }, { guide_id: "noauth" }, { guide_id: "paused" }],
      [
        { hostId: "ok", certificationStanding: "active", journeyFacilitationAuthorized: true },
        { hostId: "lapsed", certificationStanding: "inactive", journeyFacilitationAuthorized: true },
        { hostId: "noauth", certificationStanding: "active", journeyFacilitationAuthorized: false },
        { hostId: "paused", certificationStanding: "paused", journeyFacilitationAuthorized: true },
      ]
    );
    cases.push({ name: "Host-scoped access was not classified into valid / lapsed / unauthorized / reported-by-Guide-Operations", ok: access.map((a) => a.kind).join(",") === "valid,suspended_by_lapse,missing_facilitation_authorization,reported_by_guide_operations" });

    // The capability result: everything is visibility only, nothing is a task, and a quiet system is quiet.
    const participantRecords: GuideParticipantRecord[] = [{ participantId: "p", state: brokenParticipant.state, latestSessionId: "s", humanActionRequired: true, note: brokenParticipant.note }];
    const busy = classifyHostParticipantOperations([healthy, multi, stranded, gated], participantRecords, access, (id) => `host ${id}`);
    cases.push({ name: "a finding became a task for Dorian instead of visibility", ok: !(busy.people?.length || busy.decisions?.length || busy.approvals?.length || busy.problems?.length) });
    cases.push({ name: "findings were not shown under Being watched", ok: (busy.watching?.length ?? 0) >= 4 });
    const keys = (busy.watching ?? []).map((w) => w.key);
    cases.push({ name: "watching items were not unique", ok: new Set(keys).size === keys.length });
    const quiet = classifyHostParticipantOperations([healthy, finished], [], [{ guideId: "ok", kind: "valid" }], (id) => id);
    cases.push({ name: "a quiet system produced items", ok: (quiet.watching?.length ?? 0) === 0 && quiet.evaluated === 3 });

    return result(
      "pipeline_host_participant_operations",
      "Host / Participant Operations behaves as designed",
      "Simulated Hosts and Guides confirm: healthy and finished Journeys are never flagged; two active conversations, an unfinished handoff, the membership gate, an inconsistent participant record and lapsed or unauthorized Host-scoped access are each recognized once and shown as visibility, never as a task.",
      cases
    );
  });
}

// ---------------------------------------------------------------------------
// Organization / Event Operations
// ---------------------------------------------------------------------------

function organizationCheck(): CheckResult {
  return attempt("pipeline_organization_operations", "Organization / Event Operations behaves as designed", () => {
    const cases: Case[] = [];
    const goodGuide = { guideId: "g-good", status: "connected" as const, certificationActive: true, toolkitAuthorized: true };
    const run = (rows: Partial<RawOrganizationRow>[]) =>
      classifyOrganizations(
        buildOrganizationRecords(rows.map((r, i) => ({ organizationId: `o${i}`, name: `Org ${i}`, adminStatuses: ["authorized"] as OrganizationAdminStatus[], guideConnections: [goodGuide], ...r }))),
        (id) => `guide ${id}`
      );

    // A ready organization is silent.
    const ready = run([{}]);
    cases.push({ name: "a ready organization produced items", ok: !(ready.people?.length || ready.problems?.length || ready.watching?.length) && ready.evaluated === 1 });

    // No administrator: only Dorian can authorize one, so it is a task.
    const noAdmin = run([{ adminStatuses: [] }]);
    cases.push({ name: "an organization with no administrator was not a task for Dorian", ok: (noAdmin.people?.length ?? 0) === 1 });
    const revokedAdmin = run([{ adminStatuses: ["revoked"] }]);
    cases.push({ name: "an organization whose only administrator was revoked was not a task", ok: (revokedAdmin.people?.length ?? 0) === 1 });

    // No connected Guides yet: its administrator connects them, so visibility only.
    const noGuides = run([{ guideConnections: [] }]);
    cases.push({ name: "an organization with no Guides yet was a task instead of visibility", ok: (noGuides.watching?.length ?? 0) === 1 && !(noGuides.people?.length || noGuides.problems?.length) });

    // A connected Guide without active certification or Toolkit authorization.
    const badGuide = run([{ guideConnections: [goodGuide, { guideId: "g-bad", status: "connected", certificationActive: false, toolkitAuthorized: false }] }]);
    cases.push({ name: "a connected uncertified, unauthorized Guide did not raise two problems", ok: (badGuide.problems?.length ?? 0) === 2 });
    const keys = (badGuide.problems ?? []).map((p) => p.key);
    cases.push({ name: "problem items were not unique", ok: new Set(keys).size === keys.length });

    // Two authorized administrators is only worth a glance.
    const dupes = run([{ adminStatuses: ["authorized", "authorized"] }]);
    cases.push({ name: "duplicate administrators were a task instead of a glance", ok: (dupes.watching?.length ?? 0) === 1 && !dupes.problems?.length });

    // Every actionable item points where Dorian can act.
    const all = [...(noAdmin.people ?? []), ...(badGuide.problems ?? [])];
    cases.push({ name: "an item has no place to act", ok: all.every((i) => !!i.href) });

    return result(
      "pipeline_organization_operations",
      "Organization / Event Operations behaves as designed",
      "Simulated organizations confirm: a ready organization is silent; no administrator is a task for Dorian; no Guides yet and duplicate administrators are visibility only; a connected Guide without active certification or Toolkit authorization is reported once per gap.",
      cases
    );
  });
}

// ---------------------------------------------------------------------------
// Toolkit Stewardship
// ---------------------------------------------------------------------------

function toolkitCheck(): CheckResult {
  return attempt("pipeline_toolkit_stewardship", "Toolkit Stewardship behaves as designed", () => {
    const cases: Case[] = [];
    const item = (id: string, category: ToolkitSupportItem["category"], state: ToolkitSupportItem["state"] = "open", toolKey: ToolkitSupportItem["toolKey"] = "preparation"): ToolkitSupportItem => ({
      id,
      hostId: `guide-${id}`,
      hostName: null,
      toolKey,
      category,
      description: "simulated description",
      affectedResource: null,
      currentVersionOrStatus: "installed",
      state,
      requiresHumanApproval: requiresHumanApproval(category),
      assignedTo: null,
      resolution: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    const label = (id: string) => `guide ${id}`;

    // An adaptation, addition or policy item is a decision no automation may make.
    const adaptation = classifyToolkitStewardship([item("a", "ADAPTATION_REQUEST"), item("b", "ADDITION_REQUEST"), item("c", "POLICY_REQUIRED")], [], label);
    cases.push({ name: "adaptation, addition and policy items were not all decisions for Dorian", ok: (adaptation.decisions?.length ?? 0) === 3 && !adaptation.people?.length });

    // A bug report or question is a reply a person owes, not a decision.
    const routine = classifyToolkitStewardship([item("d", "BUG"), item("e", "MISSING_ASSET"), item("f", "AUTHORIZATION_QUESTION")], [], label);
    cases.push({ name: "problem reports and questions did not become replies a person owes", ok: (routine.people?.length ?? 0) === 3 && !routine.decisions?.length });

    // Resolved and closed items disappear.
    const resolved = classifyToolkitStewardship([item("g", "BUG", "resolved"), item("h", "ADAPTATION_REQUEST", "closed")], [], label);
    cases.push({ name: "a resolved or closed item still needed attention", ok: !resolved.people?.length && !resolved.decisions?.length });

    // The registry is held to its own word.
    const issues = checkToolkitRegistryHealth({ preparation: false });
    cases.push({ name: "an installed tool whose page is missing was not detected", ok: issues.some((i) => i.toolKey === "preparation" && i.kind === "marked_installed_but_route_missing") });
    const healthy = classifyToolkitStewardship([], checkToolkitRegistryHealth({}), label);
    cases.push({ name: "a healthy registry produced a problem", ok: !healthy.problems?.length });
    const broken = classifyToolkitStewardship([], issues, label);
    cases.push({ name: "a broken tool page was not a problem", ok: (broken.problems?.length ?? 0) >= 1 });

    // Several Guides hitting the same thing is surfaced as a pattern (visibility).
    const pattern = classifyToolkitStewardship([item("i", "BUG"), item("j", "BUG"), item("k", "BUG")], [], label);
    cases.push({ name: "three open reports on one tool were not noticed as a pattern", ok: (pattern.watching?.length ?? 0) === 1 });

    // A plain question the registry can answer is answered, not ticketed; an unknown one is not.
    cases.push({ name: "a routine question the registry can answer was not answered", ok: answerRoutineToolkitQuestion("preparation").kind === "answered" });

    // Items are unique and point somewhere a person can act.
    const all = [...(adaptation.decisions ?? []), ...(routine.people ?? []), ...(broken.problems ?? [])];
    cases.push({ name: "items were not unique", ok: new Set(all.map((i) => i.key)).size === all.length });
    cases.push({ name: "an item has no place to act", ok: all.every((i) => !!i.href) });

    return result(
      "pipeline_toolkit_stewardship",
      "Toolkit Stewardship behaves as designed",
      "Simulated Toolkit reports confirm: adaptation, addition and policy items are decisions for Dorian; problem reports and questions are replies a person owes; resolved items disappear; a missing tool page is a problem; repeated reports are noticed; a routine question the registry can answer is answered on the spot.",
      cases
    );
  });
}

// ---------------------------------------------------------------------------
// Conversation Integrity & Boundary Oversight
// ---------------------------------------------------------------------------

function integrityCheck(): CheckResult {
  return attempt("pipeline_conversation_integrity", "Conversation Integrity behaves as designed", () => {
    const cases: Case[] = [];

    // The scan: only the boundary problems keywords can honestly detect.
    const diagnostic = "I am diagnosing you with depression based on what you told me.";
    const prescription = "I prescribe a higher dose, so you should take 50 mg every day.";
    const legal = "As your lawyer, I can tell you that you should sue.";
    const benign = "That sounds like it has been carrying a lot of weight. What feels most present right now?";
    cases.push({ name: "a diagnosing reply was not flagged", ok: flagsForReply(diagnostic, false).some((f) => f.category === "DIAGNOSTIC_OVERREACH") });
    cases.push({ name: "a prescribing reply was not flagged", ok: flagsForReply(prescription, false).some((f) => f.category === "PRESCRIPTION") });
    cases.push({ name: "a legal-advice reply was not flagged", ok: flagsForReply(legal, false).some((f) => f.category === "SCOPE_OVERREACH") });
    cases.push({ name: "an ordinary compassionate reply was flagged", ok: flagsForReply(benign, false).length === 0 });

    // The crisis pathway: after a crisis flag, the very next reply must carry the protocol.
    cases.push({ name: "a reply that ignored the crisis pathway was not flagged", ok: flagsForReply(benign, true).some((f) => f.category === "SAFETY_PROTOCOL" && f.severity === "HIGH_PRIORITY") });
    cases.push({ name: "a reply that followed the crisis pathway was flagged", ok: flagsForReply("If you are in danger, please call 988 or 911 right now.", true).length === 0 });
    cases.push({ name: "the crisis pathway check ran when no crisis had fired", ok: flagsForReply(benign, false).length === 0 });

    // Privacy: what is stored is a category and a rule, never the reply itself.
    const stored = JSON.stringify(flagsForReply(diagnostic, false));
    cases.push({ name: "a flag carried the reply's own words", ok: !stored.includes("based on what you told me") && !stored.includes(diagnostic) });

    // What reaches Dorian.
    const flag = (id: string, severity: IntegrityFlag["severity"], category: IntegrityFlag["flagCategory"], status: IntegrityFlag["reviewStatus"] = "open", stage: IntegrityFlag["stage"] = "iap"): IntegrityFlag => ({
      id,
      conversationId: null,
      hostId: "h",
      messageId: null,
      stage,
      program: "journey",
      involvedRole: "guide",
      flagCategory: category,
      severity,
      avaiaRuleImplicated: "rule",
      detectionBasis: "basis",
      modelSnapshot: null,
      reviewStatus: status,
      humanDisposition: status === "resolved" ? "NO_VIOLATION" : null,
      correctiveAction: null,
      createdAt: "2026-01-01T00:00:00Z",
    });
    const high = classifyConversationIntegrity([flag("a", "HIGH_PRIORITY", "SAFETY_PROTOCOL"), flag("b", "POLICY_REQUIRED", "POLICY_REQUIRED"), flag("c", "LEGAL_REVIEW_REQUIRED", "LEGAL_REVIEW_REQUIRED")]);
    cases.push({ name: "high-priority, policy and legal flags were not all decisions for Dorian", ok: (high.decisions?.length ?? 0) === 3 });
    const ordinary = classifyConversationIntegrity([flag("d", "REVIEW", "DIAGNOSTIC_OVERREACH"), flag("e", "REVIEW", "PRESCRIPTION")]);
    cases.push({ name: "ordinary flags became tasks instead of visibility", ok: !ordinary.decisions?.length && (ordinary.watching?.length ?? 0) === 1 });
    const resolved = classifyConversationIntegrity([flag("f", "HIGH_PRIORITY", "SAFETY_PROTOCOL", "resolved")]);
    cases.push({ name: "a resolved flag still needed attention", ok: !resolved.decisions?.length && !resolved.watching?.length });
    const pattern = classifyConversationIntegrity([flag("g", "REVIEW", "DIAGNOSTIC_OVERREACH"), flag("h", "REVIEW", "DIAGNOSTIC_OVERREACH"), flag("i", "REVIEW", "DIAGNOSTIC_OVERREACH")]);
    cases.push({ name: "three open flags of one kind were not noticed as a pattern", ok: (pattern.decisions?.length ?? 0) >= 1 });
    const cleared = classifyConversationIntegrity([
      flag("j", "REVIEW", "DIAGNOSTIC_OVERREACH", "resolved"),
      flag("k", "REVIEW", "DIAGNOSTIC_OVERREACH", "resolved"),
      flag("l", "REVIEW", "DIAGNOSTIC_OVERREACH", "resolved"),
    ]);
    cases.push({ name: "recording dispositions did not clear the pattern", ok: !cleared.decisions?.length });
    const all = [...(high.decisions ?? []), ...(pattern.decisions ?? [])];
    cases.push({ name: "items were not unique", ok: new Set(all.map((i) => i.key)).size === all.length });
    cases.push({ name: "an item has no place to act", ok: all.every((i) => !!i.href) });

    return result(
      "pipeline_conversation_integrity",
      "Conversation Integrity behaves as designed",
      "Simulated replies confirm: diagnosing, prescribing and legal-advice language are flagged and an ordinary compassionate reply is not; a reply that ignores the crisis pathway is flagged and one that follows it is not; no flag carries the reply's words; high-priority, policy and legal flags are decisions for Dorian, ordinary flags are visibility, and recording a disposition clears them.",
      cases
    );
  });
}

export function capabilityRuleChecks(): CheckResult[] {
  return [guideOperationsCheck(), hostParticipantCheck(), organizationCheck(), toolkitCheck(), integrityCheck()];
}
