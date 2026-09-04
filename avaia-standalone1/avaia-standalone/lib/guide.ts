import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolKey } from "./toolkit";
import type { DbConversation } from "./engine/conversation";
import type { Stage, Program, DevelopmentalBand } from "./engine/prompts";
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

/** True if this Host currently holds an active Toolkit platform
 *  authorization (Phase D) -- mirrors isMember() (lib/membership.ts)
 *  exactly: one small, live-checked table, no caching, no role fallback.
 *  This is now the real Toolkit authorization source (see
 *  app/toolkit/layout.tsx) -- profiles.role = 'guide' alone is no longer
 *  sufficient to reach the Toolkit. Certification (guide_certifications)
 *  is a separate institutional fact this function never reads; whether a
 *  host was ever grantable in the first place was already enforced at
 *  grant time (Phase D.2), not re-checked here. */
export async function isToolkitAuthorized(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("guide_platform_authorizations")
    .select("id")
    .eq("host_id", userId)
    .eq("capability", "toolkit")
    .eq("status", "authorized")
    .limit(1)
    .maybeSingle();
  return data !== null;
}

/** True if this Guide currently holds an active Guided Journey
 *  Facilitation platform authorization (Phase E.1) -- same shape as
 *  isToolkitAuthorized() above, deliberately not reused for it: Toolkit
 *  and Guided Journey Facilitation are independent capabilities, and this
 *  is never a substitute for the other. Used to gate app/guided-journeys/
 *  (its own route, deliberately separate from /toolkit -- see that
 *  layout's comment) and for the small link-out shown on /toolkit itself.
 *  The actual data access on journeys/conversations/messages/referrals is
 *  enforced by RLS itself (see 0029_guide_journey_read_access.sql), not by
 *  this function. */
export async function isGuidedJourneyFacilitationAuthorized(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("guide_platform_authorizations")
    .select("id")
    .eq("host_id", userId)
    .eq("capability", "guided_journey_facilitation")
    .eq("status", "authorized")
    .limit(1)
    .maybeSingle();
  return data !== null;
}

/** True if this Guide's guide_certifications standing is currently
 *  'active' -- mirrors isToolkitAuthorized()/isGuidedJourneyFacilitationAuthorized()'s
 *  shape. Used alongside isGuidedJourneyFacilitationAuthorized() to gate
 *  app/guided-journeys/, matching exactly the two account-level conditions
 *  the Phase E.4 RLS policies also require (the third, an active Host
 *  invitation for a specific Journey, is necessarily per-journey and
 *  checked by that Journey's own RLS-protected query, not here). */
export async function isActivelyCertified(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("guide_certifications")
    .select("id")
    .eq("host_id", userId)
    .eq("standing", "active")
    .limit(1)
    .maybeSingle();
  return data !== null;
}

export type GuideParticipant = {
  id: string;
  guide_id: string;
  name: string;
  email: string | null;
  linked_host_id: string | null;
  notes: string | null;
  // Set by the Guide when starting a Youth session for this participant
  // (0038_youth_guide_facilitation.sql) -- null for every adult participant,
  // and for any Youth participant not yet started. See
  // resolveDevelopmentalBand() below for how a Guide-facilitated
  // conversation actually reads this.
  developmental_band: DevelopmentalBand | null;
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
  class_context: string | null;
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
 *  requires active Guide certification (guide_certifications.standing =
 *  'active' -- the actual institutional fact establishing Guide standing),
 *  a live Toolkit platform authorization (re-checked fresh here, not just
 *  at the /toolkit layout gate -- a Guide whose Toolkit authorization is
 *  revoked must also lose the ability to continue an already-started
 *  conversation by calling this API directly, not just lose the UI route
 *  to it), and an actual guide_sessions row tying this exact conversation
 *  to this exact Guide. This is the narrow exception /api/conversation,
 *  /api/referral, and the Unsung Heroes API routes check before falling
 *  back to their ordinary isMember() gate: it only ever unlocks a
 *  conversation the Guide's own Toolkit already created and owns, never an
 *  arbitrary Host's conversation.
 *
 *  Previously required profiles.role = 'guide' (via isGuide()) instead of
 *  isActivelyCertified() -- a stale holdover from before the Phase D
 *  platform-authorization architecture existed. profiles.role was never
 *  set by the certification grant itself (grantGuideCertification()'s own
 *  comment: "nothing here touches profiles.role") and isn't touched by
 *  Toolkit or Guided Journey Facilitation authorization either, so the two
 *  facts were never actually linked -- an account could hold role='guide'
 *  without ever being certified, or be genuinely certified and explicitly
 *  Toolkit-authorized while holding a different role (e.g. 'admin', for a
 *  Founder/operator account that also needs admin capability). Certifying
 *  and authorizing a person was already supposed to be sufficient per the
 *  Phase D principle (app/toolkit/layout.tsx's own comment: "profiles.role
 *  = 'guide' is no longer sufficient on its own to reach the Toolkit");
 *  this function just hadn't been brought in line with that yet. Not an
 *  admin bypass -- role plays no part in the check at all now, in either
 *  direction; an uncertified or unauthorized admin still can't facilitate.
 *
 *  guided_journey_facilitation (Phase E.1) is deliberately NOT checked
 *  here -- it's a separate capability gating a different feature entirely
 *  (app/guided-journeys/, a Host-invited path into the Host's own existing
 *  Journey, enforced by guide_journey_access RLS per
 *  0029_guide_journey_read_access.sql). This function's own conversations
 *  were always created and owned by the Guide's own Toolkit session, never
 *  a Host-invited one, so that capability's absence here is correct, not
 *  an oversight. */
export async function isAuthorizedGuideConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const [certified, toolkitAuthorized, session] = await Promise.all([
    isActivelyCertified(supabase, userId),
    isToolkitAuthorized(supabase, userId),
    supabase
      .from("guide_sessions")
      .select("id")
      .eq("guide_id", userId)
      .eq("conversation_id", conversationId)
      .limit(1)
      .maybeSingle(),
  ]);
  return certified && toolkitAuthorized && !!session.data;
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
 *  to send the Guide to.
 *
 *  program/sessionContext should be the CURRENT session's own values,
 *  carried forward -- e.g. a Youth Defying Grief IAP session (program:
 *  'youth', session_context: 'youth_individual') hands off a CAT session
 *  tagged the same way, not the table's bare defaults ('general' /
 *  'adult_individual'). Both default to those bare values for any caller
 *  that doesn't pass them, so this stays backward-compatible. Note this
 *  also fixes the same gap for adult Defying Grief continuity -- previously
 *  neither call site passed program through, so a Defying Grief chain's CAT
 *  and InnerCompass legs silently reverted to 'general' on this table (the
 *  underlying conversation's own program, which actually governs the
 *  model, was always correct; only this display/grouping field drifted). */
export async function findOrCreateGuideSessionForConversation(
  supabase: SupabaseClient,
  guideId: string,
  participantId: string | null,
  tool: ToolKey,
  conversationId: string,
  program: Program = "general",
  sessionContext: SessionContext = "adult_individual"
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
    .insert({
      guide_id: guideId,
      participant_id: participantId,
      tool,
      conversation_id: conversationId,
      program,
      session_context: sessionContext,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create the next session.");
  return created.id;
}

/** Resolves the developmental band governing a Youth conversation. A
 *  self-serve Youth Host's band lives on their own profile, set at /youth
 *  -- that's what /api/conversation and /api/referral read for an ordinary
 *  Youth Journey. But when the caller is a Guide running this conversation
 *  through their own Toolkit session (isAuthorizedGuideConversation's exact
 *  narrow case), the caller's profile is the GUIDE's, an adult with no
 *  band of their own -- the real answer lives on the guide_participants row
 *  the Guide set when starting the session. Checked in that order: a
 *  guide_sessions row tying this exact conversation to this caller means
 *  it's Guide-facilitated, and the participant's band governs; absent that,
 *  it's the Host's own Journey and their profile governs. Shared by both
 *  API routes so neither can drift from the other. */
export async function resolveDevelopmentalBand(
  supabase: SupabaseClient,
  callerId: string,
  conversationId: string
): Promise<DevelopmentalBand | null> {
  const { data: session } = await supabase
    .from("guide_sessions")
    .select("participant_id")
    .eq("guide_id", callerId)
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (session?.participant_id) {
    const { data: participant } = await supabase
      .from("guide_participants")
      .select("developmental_band")
      .eq("id", session.participant_id)
      .maybeSingle();
    return (participant?.developmental_band as DevelopmentalBand | null) ?? null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("developmental_band")
    .eq("id", callerId)
    .maybeSingle();
  return (profile?.developmental_band as DevelopmentalBand | null) ?? null;
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
  // Required at the DB level (0005_unsung_heroes.sql) -- "why this
  // mattered," core to the recognition, not optional.
  reflection: string;
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
