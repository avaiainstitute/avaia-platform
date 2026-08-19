import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolKey } from "./toolkit";
import type { DbConversation } from "./engine/conversation";
import type { Stage, Program } from "./engine/prompts";
import type { UnsungHeroesConversation } from "./engine/unsung-heroes";

/** Which authorized context a Guide-facilitated session ran under --
 *  infrastructure for youth/group work that doesn't exist yet (see
 *  0013_guide_toolkit_participant_record.sql's comment). Every tool
 *  installed so far only ever creates 'adult_individual' sessions. */
export type SessionContext = "adult_individual" | "youth_individual" | "group";

/** Mirrors isMember() (lib/membership.ts) and isAdmin() (the unmerged
 *  `library` branch's lib/admin.ts) exactly -- same shape, same one-column
 *  check. Guide Toolkit access is independent of membership_status, the
 *  same separation already established for Workshops/Events and One-on-One
 *  Guiding this session: a certified Guide doesn't need to also be a paying
 *  AVAIA member. */
export async function isGuide(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "guide";
}

export type GuideParticipant = {
  id: string;
  guide_id: string;
  name: string;
  email: string | null;
  linked_host_id: string | null;
  notes: string | null;
  created_at: string;
};

export type GuideSession = {
  id: string;
  guide_id: string;
  participant_id: string | null;
  tool: ToolKey;
  conversation_id: string | null;
  program: Program;
  session_context: SessionContext;
  status: "active" | "complete";
  created_at: string;
};

export async function listGuideParticipants(
  supabase: SupabaseClient,
  guideId: string
): Promise<GuideParticipant[]> {
  const { data } = await supabase
    .from("guide_participants")
    .select("*")
    .eq("guide_id", guideId)
    .order("created_at", { ascending: false });
  return (data as GuideParticipant[]) ?? [];
}

export async function listGuideSessions(
  supabase: SupabaseClient,
  guideId: string
): Promise<GuideSession[]> {
  const { data } = await supabase
    .from("guide_sessions")
    .select("*")
    .eq("guide_id", guideId)
    .order("created_at", { ascending: false });
  return (data as GuideSession[]) ?? [];
}

export async function getGuideSession(
  supabase: SupabaseClient,
  guideId: string,
  sessionId: string
): Promise<GuideSession | null> {
  const { data } = await supabase
    .from("guide_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("guide_id", guideId)
    .maybeSingle();
  return (data as GuideSession) ?? null;
}

export async function setGuideSessionConversation(
  supabase: SupabaseClient,
  sessionId: string,
  conversationId: string
): Promise<void> {
  await supabase
    .from("guide_sessions")
    .update({ conversation_id: conversationId })
    .eq("id", sessionId);
}

export async function completeGuideSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  await supabase.from("guide_sessions").update({ status: "complete" }).eq("id", sessionId);
}

/** Whether a referral already exists for this conversation -- reuses
 *  referrals.conversation_id (added in 0008_referrals_unique_conversation.sql
 *  for exactly this kind of lookup), not a new mechanism. */
export async function hasReferralForConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("referrals")
    .select("id")
    .eq("conversation_id", conversationId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Whether a Guide is authorized to run this specific conversation --
 *  requires both a live 'guide' role (checked fresh, not cached from a
 *  historical row) and an actual guide_sessions row tying this exact
 *  conversation to this exact Guide. This is the narrow exception
 *  /api/conversation and /api/referral check before falling back to their
 *  ordinary isMember() gate: it only ever unlocks a conversation the
 *  Guide's own Toolkit already created and owns, never an arbitrary Host's
 *  conversation, and never grants a Guide unrestricted access on the
 *  strength of role alone. */
export async function isAuthorizedGuideConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const [guide, session] = await Promise.all([
    isGuide(supabase, userId),
    supabase
      .from("guide_sessions")
      .select("id")
      .eq("guide_id", userId)
      .eq("conversation_id", conversationId)
      .limit(1)
      .maybeSingle(),
  ]);
  return guide && !!session.data;
}

/** Finds the conversation for a given stage within a Journey -- used after
 *  a stage's conversation reaches status: "complete" to find the next-stage
 *  conversation the frozen engine's own generateReferral() already created
 *  automatically (the exact same handoff every Host gets), so the Toolkit
 *  can offer a deliberate "Continue to X" action rather than the Guide
 *  having no way back in. Never creates anything -- if this returns null
 *  after a stage is complete, that's a real problem to surface, not paper
 *  over. */
export async function findConversationByJourneyStage(
  supabase: SupabaseClient,
  journeyId: string,
  stage: Stage
): Promise<DbConversation | null> {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("journey_id", journeyId)
    .eq("stage", stage)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DbConversation) ?? null;
}

/** Finds an existing guide_sessions row already tracking this exact
 *  (conversation, tool) pair, or creates one. This is how a session "hands
 *  off" from one Toolkit stage page to the next while sharing the same
 *  participant -- e.g. the IAP page calls this with the CAT conversation
 *  the engine just created, tool: "cat", to get (or reuse) the session id
 *  to send the Guide to. */
export async function findOrCreateGuideSessionForConversation(
  supabase: SupabaseClient,
  guideId: string,
  participantId: string | null,
  tool: ToolKey,
  conversationId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("guide_sessions")
    .select("id")
    .eq("guide_id", guideId)
    .eq("conversation_id", conversationId)
    .eq("tool", tool)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("guide_sessions")
    .insert({ guide_id: guideId, participant_id: participantId, tool, conversation_id: conversationId })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create the next session.");
  return created.id;
}

export type ReferralRow = {
  id: string;
  host_id: string;
  from_stage: Stage;
  to_stage: string;
  content: Record<string, unknown>;
  conversation_id: string | null;
  created_at: string;
};

export type RecognitionRow = {
  id: string;
  observer_id: string;
  title: string;
  who_became_visible: string;
  story: string;
  virtue_family: string;
  primary_virtue: string | null;
  conversation_path: string;
  conversation_id: string | null;
  created_at: string;
};

export type ParticipantSessionRecord = {
  session: GuideSession;
  // Populated only for tool in (iap, cat, innercompass) -- the frozen
  // Journey engine's own conversation/referral, resolved via
  // session.conversation_id. Defying Grief isn't a distinct `tool`; it's
  // these same three tools with session.program === 'defying-grief'.
  conversation: DbConversation | null;
  referral: ReferralRow | null;
  // Populated only for tool === 'unsung-heroes'.
  unsungHeroesConversation: UnsungHeroesConversation | null;
  recognition: RecognitionRow | null;
};

export type ParticipantHistory = {
  participant: GuideParticipant;
  /** Reverse chronological -- newest first, matching listGuideSessions. */
  sessions: ParticipantSessionRecord[];
};

/** Everything currently on record for one of a Guide's participants,
 *  organized by session -- the shared data behind both the Participant
 *  Record (continuity/history) and Preparation (pre-session briefing)
 *  pages, so the two surfaces never independently re-derive or drift from
 *  what "this participant's history" actually means. Resolves each
 *  guide_sessions row to its real underlying conversation/referral or
 *  Unsung Heroes conversation/recognition purely by following existing
 *  foreign keys (session.conversation_id, referrals.conversation_id,
 *  recognitions.conversation_id) -- never inventing an association a join
 *  doesn't actually support. A session whose tool isn't one of the above
 *  (future Toolkit activity) still appears, just with every resolved field
 *  null; the caller renders it from `session` alone. */
export async function getParticipantHistory(
  supabase: SupabaseClient,
  guideId: string,
  participantId: string
): Promise<ParticipantHistory | null> {
  const { data: participantData } = await supabase
    .from("guide_participants")
    .select("*")
    .eq("id", participantId)
    .eq("guide_id", guideId)
    .maybeSingle();
  if (!participantData) return null;
  const participant = participantData as GuideParticipant;

  const { data: sessionsData } = await supabase
    .from("guide_sessions")
    .select("*")
    .eq("guide_id", guideId)
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false });
  const sessions = (sessionsData as GuideSession[]) ?? [];

  const journeyToolIds = [
    ...new Set(
      sessions
        .filter((s) => s.tool === "iap" || s.tool === "cat" || s.tool === "innercompass")
        .map((s) => s.conversation_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const unsungHeroesIds = [
    ...new Set(
      sessions
        .filter((s) => s.tool === "unsung-heroes")
        .map((s) => s.conversation_id)
        .filter((id): id is string => !!id)
    ),
  ];

  const [conversationsRes, referralsRes, uhConvosRes, recognitionsRes] = await Promise.all([
    journeyToolIds.length
      ? supabase.from("conversations").select("*").in("id", journeyToolIds)
      : Promise.resolve({ data: [] as DbConversation[] }),
    journeyToolIds.length
      ? supabase.from("referrals").select("*").in("conversation_id", journeyToolIds)
      : Promise.resolve({ data: [] as ReferralRow[] }),
    unsungHeroesIds.length
      ? supabase.from("unsung_heroes_conversations").select("*").in("id", unsungHeroesIds)
      : Promise.resolve({ data: [] as UnsungHeroesConversation[] }),
    unsungHeroesIds.length
      ? supabase.from("recognitions").select("*").in("conversation_id", unsungHeroesIds)
      : Promise.resolve({ data: [] as RecognitionRow[] }),
  ]);

  const conversationById = new Map(
    ((conversationsRes.data as DbConversation[]) ?? []).map((c) => [c.id, c])
  );
  const referralByConversationId = new Map(
    ((referralsRes.data as ReferralRow[]) ?? [])
      .filter((r) => r.conversation_id)
      .map((r) => [r.conversation_id as string, r])
  );
  const uhConvoById = new Map(
    ((uhConvosRes.data as UnsungHeroesConversation[]) ?? []).map((c) => [c.id, c])
  );
  const recognitionByConversationId = new Map(
    ((recognitionsRes.data as RecognitionRow[]) ?? [])
      .filter((r) => r.conversation_id)
      .map((r) => [r.conversation_id as string, r])
  );

  const records: ParticipantSessionRecord[] = sessions.map((session) => {
    if (
      (session.tool === "iap" || session.tool === "cat" || session.tool === "innercompass") &&
      session.conversation_id
    ) {
      return {
        session,
        conversation: conversationById.get(session.conversation_id) ?? null,
        referral: referralByConversationId.get(session.conversation_id) ?? null,
        unsungHeroesConversation: null,
        recognition: null,
      };
    }
    if (session.tool === "unsung-heroes" && session.conversation_id) {
      return {
        session,
        conversation: null,
        referral: null,
        unsungHeroesConversation: uhConvoById.get(session.conversation_id) ?? null,
        recognition: recognitionByConversationId.get(session.conversation_id) ?? null,
      };
    }
    return {
      session,
      conversation: null,
      referral: null,
      unsungHeroesConversation: null,
      recognition: null,
    };
  });

  return { participant, sessions: records };
}
