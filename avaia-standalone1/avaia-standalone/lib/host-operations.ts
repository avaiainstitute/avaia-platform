import "server-only";

/**
 * AVAIA Host / Participant Operations: typed, deterministic resolvers. This
 * module owns operational logistics for people using AVAIA (entering, finding
 * their session/Experience, returning to something started, reconciling
 * deterministic mismatches). It NEVER interprets what a Host means, diagnoses,
 * prescribes, assigns virtues or Secondary Losses, or makes a safety judgment:
 * it reads existing records (stage/status/membership metadata only, never
 * conversation content) and reports mechanical facts.
 *
 * Adapted to current production architecture (the original build predates it):
 *  - Membership is the entitlements table (lib/membership.ts), not the frozen
 *    profiles.membership_status column. IAP is free; CAT and InnerCompass
 *    require membership unless the conversation runs inside an authorized
 *    Guide session. This module resolves the Host's own, non-Guide-facilitated
 *    standing only (Guide authorization lives in lib/guide-operations.ts).
 *  - Completing a stage is TWO steps by design: generateGuidesRecord marks the
 *    conversation complete and saves the Guide's Record, then
 *    advanceToNextStage creates the next stage (lib/engine/referral-generation.ts).
 *    A completed stage with no next stage is therefore a normal state in two
 *    cases ("Start a New Journey" deliberately leaves a record without
 *    advancing; a handoff interrupted by the serverless time limit), and
 *    ensureNextStageConversation heals it the next time the Host returns.
 *    It is reported here as visibility, not as a failure.
 *  - A Host has at most one conversation with status 'active' at a time
 *    (getActiveConversation assumes this); more than one is reported.
 *
 * Nothing here ever changes a record. What it finds is shown in "Being watched"
 * in What Needs Dorian, because there is nothing for Dorian to decide: the
 * records are repaired by the product itself when the person returns.
 */

export const HOST_JOURNEY_STATES = [
  "account_created_no_journey",
  "iap_in_progress",
  "cat_available",
  "cat_in_progress",
  "innercompass_available",
  "innercompass_in_progress",
  "journey_complete",
  "continuation_blocked_by_entitlement",
  "operational_mismatch",
] as const;

export type HostJourneyState = (typeof HOST_JOURNEY_STATES)[number];

export const HOST_MISMATCH_TYPES = [
  "multiple_active_conversations",
  "stage_complete_handoff_missing",
] as const;

export type HostMismatchType = (typeof HOST_MISMATCH_TYPES)[number];

export type HostMismatch = { type: HostMismatchType; detail: string };

export type JourneyStage = "iap" | "cat" | "innercompass";

export const JOURNEY_STAGE_ORDER: JourneyStage[] = ["iap", "cat", "innercompass"];

export type HostConversationRow = {
  id: string;
  stage: JourneyStage;
  status: "active" | "complete";
  created_at: string;
  journey_id: string | null;
};

export type HostJourneyRecord = {
  hostId: string;
  isMember: boolean;
  state: HostJourneyState;
  currentStage: JourneyStage | null;
  mismatches: HostMismatch[];
  humanActionRequired: boolean;
};

/** Pure derivation. `conversations` is every conversation row for one Host
 *  (small, metadata-only columns -- never messages.content). `engagedConversationIds`
 *  is the set of conversation ids where the Host has authored at least one
 *  message (used only to tell "available" from "in progress"; this module
 *  never reads what that message said). `journeyConversationsById` supplies,
 *  for handoff verification, every conversation row sharing a journey_id
 *  with any of this Host's rows (so a same-journey next-stage row can be
 *  found even though conversations are looked up by host, not journey). */
export function deriveHostJourneyState(args: {
  conversations: HostConversationRow[];
  engagedConversationIds: Set<string>;
  isMember: boolean;
}): { state: HostJourneyState; currentStage: JourneyStage | null; mismatches: HostMismatch[]; humanActionRequired: boolean } {
  const { conversations, engagedConversationIds, isMember } = args;
  const mismatches: HostMismatch[] = [];

  if (conversations.length === 0) {
    return { state: "account_created_no_journey", currentStage: null, mismatches, humanActionRequired: false };
  }

  const active = conversations.filter((c) => c.status === "active");
  if (active.length > 1) {
    mismatches.push({
      type: "multiple_active_conversations",
      detail: `${active.length} conversations are simultaneously active; the architecture expects at most one.`,
    });
  }

  // Handoff verification: every complete, non-final-stage conversation
  // must have a same-journey conversation at the next stage. Checked
  // across all of this Host's rows, not just the current one, so a stale
  // mismatch further back in the journey is never hidden by later progress.
  const byJourneyAndStage = new Map<string, HostConversationRow[]>();
  for (const c of conversations) {
    const key = `${c.journey_id ?? "none"}:${c.stage}`;
    const list = byJourneyAndStage.get(key) ?? [];
    list.push(c);
    byJourneyAndStage.set(key, list);
  }
  for (const c of conversations) {
    if (c.status !== "complete") continue;
    const idx = JOURNEY_STAGE_ORDER.indexOf(c.stage);
    const nextStage = JOURNEY_STAGE_ORDER[idx + 1];
    if (!nextStage || !c.journey_id) continue;
    const nextKey = `${c.journey_id}:${nextStage}`;
    if (!byJourneyAndStage.has(nextKey)) {
      mismatches.push({
        type: "stage_complete_handoff_missing",
        detail: `${c.stage} is complete but no ${nextStage} conversation exists yet for its journey (it is created when the Host returns, or the Host started a new Journey).`,
      });
    }
  }

  // Current position: the active conversation (most recently created, if
  // the mismatch above produced more than one), or -- if none is active --
  // the most advanced stage reached.
  const mostRecentActive = [...active].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  if (!mostRecentActive) {
    const innercompassComplete = conversations.some((c) => c.stage === "innercompass" && c.status === "complete");
    if (innercompassComplete) {
      return { state: "journey_complete", currentStage: "innercompass", mismatches, humanActionRequired: mismatches.length > 0 };
    }
    // No active conversation and the journey isn't actually finished --
    // exactly the handoff-failure condition above; surfaced as its own
    // top-level state so it is never mistaken for a quiet, healthy "done".
    return { state: "operational_mismatch", currentStage: null, mismatches, humanActionRequired: true };
  }

  const stage = mostRecentActive.stage;
  const engaged = engagedConversationIds.has(mostRecentActive.id);

  let state: HostJourneyState;
  if (stage === "iap") {
    state = "iap_in_progress";
  } else if (!isMember) {
    state = "continuation_blocked_by_entitlement";
  } else {
    state = engaged ? (`${stage}_in_progress` as HostJourneyState) : (`${stage}_available` as HostJourneyState);
  }

  return { state, currentStage: stage, mismatches, humanActionRequired: mismatches.length > 0 };
}

// ---------------------------------------------------------------------------
// Guide-facilitated participant operational state.
// ---------------------------------------------------------------------------

export const GUIDE_PARTICIPANT_STATES = [
  "ready_for_session",
  "session_in_progress",
  "session_complete",
  "follow_up_available",
  "operational_mismatch",
] as const;

export type GuideParticipantState = (typeof GUIDE_PARTICIPANT_STATES)[number];

export type GuideSessionRow = {
  id: string;
  tool: string;
  status: "active" | "complete";
  conversation_id: string | null;
  created_at: string;
};

export type GuideParticipantRecord = {
  participantId: string;
  state: GuideParticipantState;
  latestSessionId: string | null;
  humanActionRequired: boolean;
  note: string | null;
};

/** Pure derivation for one participant. `nextConversationAwaitingSession`
 *  is true when the engine already created the next-stage conversation
 *  (the same auto-handoff the public Journey gets) but no guide_sessions
 *  row has been created to carry the Guide to it yet -- the real,
 *  provable "follow_up_available" moment (see
 *  app/toolkit/cat/[sessionId]/page.tsx's own findConversationByJourneyStage
 *  + findOrCreateGuideSessionForConversation pattern, which this mirrors
 *  read-only). AVAIA currently has no invitation/invite-token concept for
 *  guide_participants (participants are created directly by the Guide and
 *  linked by email lookup, never invited) -- so "invited" and
 *  "invitation_pending" are deliberately NOT modeled here; inventing them
 *  would misrepresent what the schema actually supports. */
export function deriveGuideParticipantState(args: {
  sessions: GuideSessionRow[];
  nextConversationAwaitingSession: boolean;
}): { state: GuideParticipantState; latestSessionId: string | null; humanActionRequired: boolean; note: string | null } {
  const { sessions, nextConversationAwaitingSession } = args;

  if (sessions.length === 0) {
    return { state: "ready_for_session", latestSessionId: null, humanActionRequired: false, note: null };
  }

  const latest = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  if (latest.status === "complete" && !latest.conversation_id) {
    return {
      state: "operational_mismatch",
      latestSessionId: latest.id,
      humanActionRequired: true,
      note: "Most recent session is marked complete but has no conversation attached.",
    };
  }

  if (latest.status === "active") {
    return { state: "session_in_progress", latestSessionId: latest.id, humanActionRequired: false, note: null };
  }

  if (nextConversationAwaitingSession) {
    return { state: "follow_up_available", latestSessionId: latest.id, humanActionRequired: false, note: null };
  }

  return { state: "session_complete", latestSessionId: latest.id, humanActionRequired: false, note: null };
}

/** Guide-scoped convenience accessor for the Guide's own Toolkit dashboard
 *  (app/toolkit/page.tsx) -- uses the ordinary RLS-respecting client, never
 *  the admin client, so a Guide can only ever resolve their own
 *  participants' sessions and their own conversations (guide_participants,
 *  guide_sessions, and conversations are all scoped to this Guide's own
 *  rows by existing RLS -- a guide_sessions-linked conversation's host_id
 *  is the Guide's own id, since Toolkit sessions are created under the
 *  Guide's account; see app/toolkit/iap/[sessionId]/page.tsx). Mirrors the
 *  single-entity accessor shape of getGuideOperationsRecordForHost in
 *  lib/guide-operations.ts. */
export async function getGuideParticipantStatusesForGuide(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  guideId: string
): Promise<Map<string, GuideParticipantRecord>> {
  const [{ data: sessionRows }, { data: conversationRows }] = await Promise.all([
    supabase
      .from("guide_sessions")
      .select("id, participant_id, tool, status, conversation_id, created_at")
      .eq("guide_id", guideId),
    supabase.from("conversations").select("id, stage, status, journey_id").eq("host_id", guideId),
  ]);

  const sessions = (sessionRows ?? []) as GuideSessionRow[] & { participant_id: string | null }[];
  const conversations = (conversationRows ?? []) as { id: string; stage: JourneyStage; status: "active" | "complete"; journey_id: string | null }[];
  const conversationById = new Map(conversations.map((c) => [c.id, c]));
  const sessionConversationIds = new Set(sessions.map((s) => (s as { conversation_id: string | null }).conversation_id).filter(Boolean) as string[]);

  const sessionsByParticipant = new Map<string, GuideSessionRow[]>();
  for (const s of sessions as unknown as (GuideSessionRow & { participant_id: string | null })[]) {
    if (!s.participant_id) continue;
    const list = sessionsByParticipant.get(s.participant_id) ?? [];
    list.push(s);
    sessionsByParticipant.set(s.participant_id, list);
  }

  const result = new Map<string, GuideParticipantRecord>();
  for (const [participantId, participantSessions] of sessionsByParticipant) {
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
          const nextConvo = conversations.find((c) => c.journey_id === convo.journey_id && c.stage === nextStage);
          nextConversationAwaitingSession = !!nextConvo && !sessionConversationIds.has(nextConvo.id);
        }
      }
    }

    const { state, latestSessionId, humanActionRequired, note } = deriveGuideParticipantState({
      sessions: participantSessions,
      nextConversationAwaitingSession,
    });
    result.set(participantId, { participantId, state, latestSessionId, humanActionRequired, note });
  }

  return result;
}
