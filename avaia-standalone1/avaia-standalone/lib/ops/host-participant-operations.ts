import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllGuideOperationsRecords } from "@/lib/ops/guide-access-operations";
import {
  deriveHostJourneyState,
  deriveGuideParticipantState,
  JOURNEY_STAGE_ORDER,
  type HostJourneyRecord,
  type HostMismatch,
  type HostConversationRow,
  type JourneyStage,
  type GuideParticipantRecord,
  type GuideSessionRow,
} from "@/lib/host-operations";

// Host / Participant Operations Agent -- admin-client batched fetch + daily
// cron notification. Mirrors lib/ops/guide-access-operations.ts's own
// shape exactly: one admin-client pass over the relevant tables, pure
// derivation (lib/host-operations.ts), then a cooldown-gated sendFn loop
// that only ever notifies admin/ops and never changes conversations.status,
// profiles.membership_status, guide_sessions.status, or any access row
// itself. Reads status/stage/membership metadata only -- nothing here ever
// selects messages.content or any other conversation text; the one place
// messages are touched (engagement detection below) selects role only.

const COOLDOWN_DAYS = Number(process.env.HOST_PARTICIPANT_OPERATIONS_COOLDOWN_DAYS ?? 3);

// ---------------------------------------------------------------------------
// Host Journey records
// ---------------------------------------------------------------------------

export async function getAllHostJourneyRecords(): Promise<HostJourneyRecord[]> {
  const admin = createAdminClient();

  const [{ data: profileRows }, { data: conversationRows }] = await Promise.all([
    admin.from("profiles").select("id, membership_status"),
    admin
      .from("conversations")
      .select("id, host_id, stage, status, created_at, journey_id")
      .order("created_at", { ascending: true }),
  ]);

  type ConvoRow = { id: string; host_id: string; stage: JourneyStage; status: "active" | "complete"; created_at: string; journey_id: string | null };
  const conversations = (conversationRows ?? []) as ConvoRow[];

  const byHost = new Map<string, HostConversationRow[]>();
  for (const c of conversations) {
    const list = byHost.get(c.host_id) ?? [];
    list.push({ id: c.id, stage: c.stage, status: c.status, created_at: c.created_at, journey_id: c.journey_id });
    byHost.set(c.host_id, list);
  }

  // Engagement: which active conversations have at least one host-authored
  // message. Only `role` and `conversation_id` are selected -- never content.
  const activeConversationIds = conversations.filter((c) => c.status === "active").map((c) => c.id);
  const engagedConversationIds = new Set<string>();
  if (activeConversationIds.length > 0) {
    const { data: messageRows } = await admin
      .from("messages")
      .select("conversation_id, role")
      .in("conversation_id", activeConversationIds)
      .eq("role", "host");
    for (const m of (messageRows ?? []) as { conversation_id: string }[]) {
      engagedConversationIds.add(m.conversation_id);
    }
  }

  const memberships = new Map(
    (profileRows ?? []).map((p: { id: string; membership_status: string | null }) => [p.id, p.membership_status === "member"])
  );

  const records: HostJourneyRecord[] = [];
  for (const [hostId, isMember] of memberships) {
    const hostConversations = byHost.get(hostId) ?? [];
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

  // For "follow_up_available": a same-journey conversation at the next
  // stage already exists (the engine's own auto-handoff) but no
  // guide_sessions row yet references it for this participant.
  const journeyStageKeys = new Set(
    conversations.filter((c) => c.journey_id).map((c) => `${c.journey_id}:${c.stage}`)
  );
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
    const latest = [...participantSessions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    let nextConversationAwaitingSession = false;
    if (latest?.status === "complete" && latest.conversation_id) {
      const convo = conversationById.get(latest.conversation_id);
      if (convo?.journey_id) {
        const idx = JOURNEY_STAGE_ORDER.indexOf(convo.stage);
        const nextStage = JOURNEY_STAGE_ORDER[idx + 1];
        if (nextStage) {
          const nextKey = `${convo.journey_id}:${nextStage}`;
          const nextConvo = conversations.find((c) => c.journey_id === convo.journey_id && c.stage === nextStage);
          nextConversationAwaitingSession =
            journeyStageKeys.has(nextKey) && !!nextConvo && !sessionConversationIds.has(nextConvo.id);
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
// Host-scoped Guide access: confirm/notify/detect only (item 5). Reuses
// Guide Operations' own records rather than re-deriving certification/
// authorization validity a second time.
// ---------------------------------------------------------------------------

export type HostScopedAccessStatus = {
  guideId: string;
  valid: boolean;
  detail: string;
};

/** Cross-checks every currently-active guide_journey_access grant against
 *  the Guide's own Guide Operations record. Read-only -- never creates,
 *  restores, or revokes a grant. A Host revoking access (guide_journey_access
 *  host revoke policy, revoked_at set) is a one-way UPDATE enforced by RLS
 *  itself; this never touches that column. */
export async function getHostScopedAccessStatuses(): Promise<HostScopedAccessStatus[]> {
  const admin = createAdminClient();
  const [{ data: grants }, guideRecords] = await Promise.all([
    admin.from("guide_journey_access").select("guide_id, host_id").is("revoked_at", null),
    getAllGuideOperationsRecords(),
  ]);

  const guideById = new Map(guideRecords.map((g) => [g.hostId, g]));
  const statuses: HostScopedAccessStatus[] = [];
  for (const grant of (grants ?? []) as { guide_id: string; host_id: string }[]) {
    const guide = guideById.get(grant.guide_id);
    const valid = guide?.certificationStanding === "active" && guide.journeyFacilitationAuthorized;
    statuses.push({
      guideId: grant.guide_id,
      valid: !!valid,
      detail: valid
        ? "Active Host-scoped access; Guide standing and authorization are both valid."
        : `Active Host-scoped access, but Guide standing is ${guide?.certificationStanding ?? "absent"} and Guided Journey Facilitation authorization is ${
            guide?.journeyFacilitationAuthorized ? "active" : "not active"
          }.`,
    });
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// Summary + cron exceptions
// ---------------------------------------------------------------------------

export type HostParticipantOperationsSummary = {
  hostsOnboardingStalled: number;
  hostsBlockedByEntitlement: number;
  hostOperationalMismatches: number;
  participantsReadyOrInProgress: number;
  participantMismatches: number;
  invalidHostScopedAccess: number;
};

export async function getHostParticipantOperationsSummary(): Promise<{
  summary: HostParticipantOperationsSummary;
  hostRecords: HostJourneyRecord[];
  participantRecords: GuideParticipantRecord[];
}> {
  const [hostRecords, participantRecords, accessStatuses] = await Promise.all([
    getAllHostJourneyRecords(),
    getAllGuideParticipantRecords(),
    getHostScopedAccessStatuses(),
  ]);

  const summary: HostParticipantOperationsSummary = {
    hostsOnboardingStalled: hostRecords.filter((r) => r.state === "account_created_no_journey" || r.state === "iap_in_progress").length,
    hostsBlockedByEntitlement: hostRecords.filter((r) => r.state === "continuation_blocked_by_entitlement").length,
    hostOperationalMismatches: hostRecords.filter((r) => r.mismatches.length > 0).length,
    participantsReadyOrInProgress: participantRecords.filter(
      (r) => r.state === "ready_for_session" || r.state === "session_in_progress"
    ).length,
    participantMismatches: participantRecords.filter((r) => r.state === "operational_mismatch").length,
    invalidHostScopedAccess: accessStatuses.filter((a) => !a.valid).length,
  };

  return { summary, hostRecords, participantRecords };
}

export type HostParticipantNotification = {
  subjectType: "host" | "guide_participant";
  subjectId: string;
  category: "MISSING" | "WAITING" | "STALE" | "MISMATCH" | "FAILED" | "HUMAN_DECISION_REQUIRED" | "POLICY_REQUIRED";
  detail: string;
  operationalState: string;
};

/** Cron body -- same cooldown/idempotency shape as
 *  recordGuideAccessExceptions. One host_participant_operations_exceptions
 *  row per (subject, category, detail) per notification, never repeated
 *  inside COOLDOWN_DAYS. sendFn is expected to notify admin/ops only -- this
 *  never contacts a Host, Guide, or participant, and never writes to any
 *  table other than host_participant_operations_exceptions. Only genuine
 *  mismatches are reported here (MISMATCH/HUMAN_DECISION_REQUIRED) --
 *  ordinary onboarding stalls are already handled, with the required
 *  low-pressure factual tone, by the existing
 *  lib/ops/host-onboarding.ts / app/api/cron/host-onboarding -- this does
 *  not duplicate that participant-facing messaging. */
export async function recordHostParticipantOperationsExceptions(
  sendFn: (n: HostParticipantNotification) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number }> {
  const admin = createAdminClient();
  const [hostRecords, participantRecords, accessStatuses] = await Promise.all([
    getAllHostJourneyRecords(),
    getAllGuideParticipantRecords(),
    getHostScopedAccessStatuses(),
  ]);

  const notifications: HostParticipantNotification[] = [];

  for (const record of hostRecords) {
    for (const mismatch of record.mismatches) {
      notifications.push({
        subjectType: "host",
        subjectId: record.hostId,
        category: "MISMATCH",
        detail: mismatch.detail,
        operationalState: record.state,
      });
    }
    if (record.state === "operational_mismatch" && record.mismatches.length === 0) {
      notifications.push({
        subjectType: "host",
        subjectId: record.hostId,
        category: "HUMAN_DECISION_REQUIRED",
        detail: "No active conversation, but the journey is not complete -- a handoff did not occur as expected.",
        operationalState: record.state,
      });
    }
  }

  for (const record of participantRecords) {
    if (record.state === "operational_mismatch") {
      notifications.push({
        subjectType: "guide_participant",
        subjectId: record.participantId,
        category: "MISMATCH",
        detail: record.note ?? "Participant operational state is inconsistent.",
        operationalState: record.state,
      });
    }
  }

  for (const access of accessStatuses) {
    if (!access.valid) {
      notifications.push({
        subjectType: "host",
        subjectId: access.guideId,
        category: "MISMATCH",
        detail: access.detail,
        operationalState: "invalid_host_scoped_access",
      });
    }
  }

  let sent = 0;
  let skippedCooldown = 0;

  for (const n of notifications) {
    const { data: lastRow } = await admin
      .from("host_participant_operations_exceptions")
      .select("sent_at")
      .eq("subject_type", n.subjectType)
      .eq("subject_id", n.subjectId)
      .eq("category", n.category)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRow) {
      const daysSince = (Date.now() - new Date(lastRow.sent_at).getTime()) / 86_400_000;
      if (daysSince < COOLDOWN_DAYS) {
        skippedCooldown += 1;
        continue;
      }
    }

    await sendFn(n);
    await admin.from("host_participant_operations_exceptions").insert({
      subject_type: n.subjectType,
      subject_id: n.subjectId,
      category: n.category,
      detail: n.detail,
      operational_state: n.operationalState,
    });
    sent += 1;
  }

  return { sent, skippedCooldown };
}
