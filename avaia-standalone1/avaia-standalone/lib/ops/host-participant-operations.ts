import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveGuideParticipantState,
  deriveHostJourneyState,
  JOURNEY_STAGE_ORDER,
  type GuideParticipantRecord,
  type GuideSessionRow,
  type HostConversationRow,
  type HostJourneyRecord,
  type JourneyStage,
} from "@/lib/host-operations";
import { getAllGuideOperationsRecords } from "@/lib/ops/guide-access-operations";
import { hostLabels } from "@/lib/ops/host-labels";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";

// HOST / PARTICIPANT OPERATIONS, as an operational capability. Reads each
// Host's journey metadata (stage, status, membership; never message content),
// each Guide-facilitated participant's session metadata, and each Host-scoped
// Guide grant; applies the rules in lib/host-operations.ts; and shows what it
// finds in What Needs Dorian. Nothing it finds is a decision for Dorian (the
// product repairs a stranded handoff itself when the person returns), so it is
// reported under "Being watched" and is never counted as a task. It changes
// nothing and emails nobody.

// ---------------------------------------------------------------------------
// Host Journey records
// ---------------------------------------------------------------------------

export async function getAllHostJourneyRecords(): Promise<HostJourneyRecord[]> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const [{ data: conversationRows }, { data: entitlementRows }] = await Promise.all([
    admin.from("conversations").select("id, host_id, stage, status, created_at, journey_id").order("created_at", { ascending: true }),
    // Membership is the entitlements table (same meaning of "active" as lib/membership.ts).
    admin.from("entitlements").select("host_id").eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`),
  ]);

  type ConvoRow = { id: string; host_id: string; stage: JourneyStage; status: "active" | "complete"; created_at: string; journey_id: string | null };
  const conversations = (conversationRows ?? []) as ConvoRow[];
  // Only the three Journey stages are part of this resolver.
  const journeyConversations = conversations.filter((c) => JOURNEY_STAGE_ORDER.includes(c.stage));

  const byHost = new Map<string, HostConversationRow[]>();
  for (const c of journeyConversations) {
    const list = byHost.get(c.host_id) ?? [];
    list.push({ id: c.id, stage: c.stage, status: c.status, created_at: c.created_at, journey_id: c.journey_id });
    byHost.set(c.host_id, list);
  }

  // Engagement: which active conversations have at least one host-authored message.
  // Only `role` and `conversation_id` are selected, never content.
  const activeIds = journeyConversations.filter((c) => c.status === "active").map((c) => c.id);
  const engagedConversationIds = new Set<string>();
  for (let i = 0; i < activeIds.length; i += 40) {
    const { data: messageRows } = await admin
      .from("messages")
      .select("conversation_id, role")
      .in("conversation_id", activeIds.slice(i, i + 40))
      .eq("role", "host")
      .limit(2000);
    for (const m of (messageRows ?? []) as { conversation_id: string }[]) engagedConversationIds.add(m.conversation_id);
  }

  const members = new Set(((entitlementRows ?? []) as { host_id: string }[]).map((r) => r.host_id));

  const records: HostJourneyRecord[] = [];
  for (const [hostId, hostConversations] of byHost) {
    const isMember = members.has(hostId);
    const { state, currentStage, mismatches, humanActionRequired } = deriveHostJourneyState({
      conversations: hostConversations,
      engagedConversationIds,
      isMember,
    });
    records.push({ hostId, isMember, state, currentStage, mismatches, humanActionRequired });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Guide-facilitated participant records
// ---------------------------------------------------------------------------

export async function getAllGuideParticipantRecords(): Promise<GuideParticipantRecord[]> {
  const admin = createAdminClient();

  const [{ data: participantRows }, { data: sessionRows }, { data: conversationRows }] = await Promise.all([
    admin.from("guide_participants").select("id"),
    admin.from("guide_sessions").select("id, participant_id, tool, status, conversation_id, created_at"),
    admin.from("conversations").select("id, stage, status, journey_id"),
  ]);

  type SessionRow = { id: string; participant_id: string | null; tool: string; status: "active" | "complete"; conversation_id: string | null; created_at: string };
  const sessions = (sessionRows ?? []) as SessionRow[];
  type ConvoRow = { id: string; stage: JourneyStage; status: "active" | "complete"; journey_id: string | null };
  const conversations = (conversationRows ?? []) as ConvoRow[];
  const conversationById = new Map(conversations.map((c) => [c.id, c]));
  const sessionConversationIds = new Set(sessions.map((s) => s.conversation_id).filter(Boolean) as string[]);

  const sessionsByParticipant = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.participant_id) continue;
    const list = sessionsByParticipant.get(s.participant_id) ?? [];
    list.push(s);
    sessionsByParticipant.set(s.participant_id, list);
  }

  const records: GuideParticipantRecord[] = [];
  for (const p of (participantRows ?? []) as { id: string }[]) {
    const participantSessions = sessionsByParticipant.get(p.id) ?? [];
    const latest = [...participantSessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    // "Follow-up available": the engine already created the next-stage conversation but
    // no guide_sessions row yet carries the Guide to it.
    let nextConversationAwaitingSession = false;
    if (latest?.status === "complete" && latest.conversation_id) {
      const convo = conversationById.get(latest.conversation_id);
      if (convo?.journey_id) {
        const nextStage = JOURNEY_STAGE_ORDER[JOURNEY_STAGE_ORDER.indexOf(convo.stage) + 1];
        if (nextStage) {
          const nextConvo = conversations.find((c) => c.journey_id === convo.journey_id && c.stage === nextStage);
          nextConversationAwaitingSession = !!nextConvo && !sessionConversationIds.has(nextConvo.id);
        }
      }
    }

    const sessionRowsTyped: GuideSessionRow[] = participantSessions.map((s) => ({
      id: s.id,
      tool: s.tool,
      status: s.status,
      conversation_id: s.conversation_id,
      created_at: s.created_at,
    }));
    const { state, latestSessionId, humanActionRequired, note } = deriveGuideParticipantState({
      sessions: sessionRowsTyped,
      nextConversationAwaitingSession,
    });
    records.push({ participantId: p.id, state, latestSessionId, humanActionRequired, note });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Host-scoped Guide access. Reuses Guide Operations' own records rather than
// re-deriving certification/authorization validity a second time. Standing
// problems (paused, revoked, absent) are already reported by Guide Operations
// as mismatches; this adds the two cases it does not cover: a lapsed
// certification (access suspended by the gate, records kept by design) and an
// active certification without Guided Journey Facilitation authorization.
// ---------------------------------------------------------------------------

export type HostScopedAccessStatus = {
  guideId: string;
  kind: "valid" | "suspended_by_lapse" | "missing_facilitation_authorization" | "reported_by_guide_operations";
};

export function classifyHostScopedAccess(
  grants: { guide_id: string }[],
  guideRecords: { hostId: string; certificationStanding: string | null; journeyFacilitationAuthorized: boolean }[]
): HostScopedAccessStatus[] {
  const guideById = new Map(guideRecords.map((g) => [g.hostId, g]));
  return grants.map((grant) => {
    const guide = guideById.get(grant.guide_id);
    const standing = guide?.certificationStanding ?? null;
    if (standing === "active") {
      return { guideId: grant.guide_id, kind: guide?.journeyFacilitationAuthorized ? "valid" : "missing_facilitation_authorization" };
    }
    if (standing === "inactive") return { guideId: grant.guide_id, kind: "suspended_by_lapse" };
    return { guideId: grant.guide_id, kind: "reported_by_guide_operations" };
  });
}

export async function getHostScopedAccessStatuses(): Promise<HostScopedAccessStatus[]> {
  const admin = createAdminClient();
  const [{ data: grants }, guideRecords] = await Promise.all([
    admin.from("guide_journey_access").select("guide_id, host_id").is("revoked_at", null),
    getAllGuideOperationsRecords(),
  ]);
  return classifyHostScopedAccess((grants ?? []) as { guide_id: string }[], guideRecords);
}

// ---------------------------------------------------------------------------
// The capability
// ---------------------------------------------------------------------------

const SHOW = 5;

/** Pure: turns records into the capability result, all under "Being watched". */
export function classifyHostParticipantOperations(
  hosts: HostJourneyRecord[],
  participants: GuideParticipantRecord[],
  access: HostScopedAccessStatus[],
  label: (id: string) => string
): CapabilityResult {
  const watching: NeedsItem[] = [];
  const names = (ids: string[]) => {
    const shown = ids.slice(0, SHOW).map(label).join(", ");
    return ids.length > SHOW ? `${shown}, and ${ids.length - SHOW} more` : shown;
  };

  const multiple = hosts.filter((h) => h.mismatches.some((m) => m.type === "multiple_active_conversations")).map((h) => h.hostId);
  if (multiple.length > 0) {
    watching.push({
      key: "host-ops:multiple-active",
      text: `${multiple.length} Host(s) have more than one active conversation (the product expects one): ${names(multiple)}. Nothing needed unless a Host reports confusion.`,
      href: "/admin/operations",
    });
  }

  const stranded = hosts.filter((h) => h.mismatches.some((m) => m.type === "stage_complete_handoff_missing")).map((h) => h.hostId);
  if (stranded.length > 0) {
    watching.push({
      key: "host-ops:handoff-pending",
      text: `${stranded.length} Host(s) finished a stage whose next stage has not been created yet. The product creates it when they return (or they started a new Journey); the onboarding reminders already reach those who stall. Listed for visibility only.`,
      href: "/admin/operations",
    });
  }

  const blocked = hosts.filter((h) => h.state === "continuation_blocked_by_entitlement").length;
  if (blocked > 0) {
    watching.push({
      key: "host-ops:membership-gate",
      text: `${blocked} Host(s) finished the free stage and are at the membership gate (Individual Awareness Profile is free; the next stages need membership). Visibility only.`,
    });
  }

  const brokenParticipants = participants.filter((p) => p.state === "operational_mismatch");
  for (const p of brokenParticipants.slice(0, SHOW)) {
    watching.push({
      key: `host-ops:participant:${p.participantId}`,
      text: `A Guide's participant record looks inconsistent: ${p.note ?? "operational mismatch"}`,
      href: "/admin/operations",
    });
  }

  const suspended = access.filter((a) => a.kind === "suspended_by_lapse").length;
  if (suspended > 0) {
    watching.push({
      key: "host-ops:access-suspended",
      text: `${suspended} Host-scoped Guide relationship(s) belong to a Guide whose certification has lapsed; their access is suspended automatically and the records are preserved (they restore if the certification is reactivated).`,
      href: "/admin/guide-certifications",
    });
  }
  const missingAuth = access.filter((a) => a.kind === "missing_facilitation_authorization").length;
  if (missingAuth > 0) {
    watching.push({
      key: "host-ops:access-missing-authorization",
      text: `${missingAuth} Host-scoped Guide relationship(s) belong to a certified Guide who has no Guided Journey Facilitation authorization, so the Guide cannot act on them.`,
      href: "/admin/guide-certifications",
    });
  }

  return {
    key: "host_participant_operations",
    label: "Host / Participant Operations",
    evaluated: hosts.length + participants.length + access.length,
    watching,
  };
}

export async function evaluateHostParticipantOperations(): Promise<CapabilityResult> {
  const [hosts, participants, access] = await Promise.all([getAllHostJourneyRecords(), getAllGuideParticipantRecords(), getHostScopedAccessStatuses()]);
  const idsToName = [
    ...hosts.filter((h) => h.mismatches.some((m) => m.type === "multiple_active_conversations")).map((h) => h.hostId).slice(0, SHOW),
  ];
  const label = await hostLabels(idsToName);
  return classifyHostParticipantOperations(hosts, participants, access, label);
}
