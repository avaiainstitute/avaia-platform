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

/** Certification standing, read directly -- never cached, never inferred
 *  from role. 'active' is the only standing that should ever gate
 *  operational Guide access; a missing row (never certified) is treated
 *  the same as not-active. Guide Operations Agent: role alone, or an
 *  authorization row alone, is never sufficient -- see
 *  lib/guide-operations.ts for the full deterministic rationale. */
export async function hasActiveCertificationStanding(supabase: SupabaseClient, hostId: string): Promise<boolean> {
  const { data } = await supabase
    .from("guide_certifications")
    .select("standing")
    .eq("host_id", hostId)
    .maybeSingle();
  return data?.standing === "active";
}

/** Whether the most recent guide_platform_authorizations row for this
 *  (host, capability) pair is 'authorized'. These rows are an append-only
 *  history (a new row per grant/revoke, not an update-in-place), so
 *  "current" means the one with the latest status_changed_at (falling
 *  back to granted_at) -- the same rule lib/certification-operations.ts
 *  uses for the same table. */
export async function hasAuthorizedPlatformCapability(
  supabase: SupabaseClient,
  hostId: string,
  capability: "toolkit" | "guided_journey_facilitation"
): Promise<boolean> {
  const { data } = await supabase
    .from("guide_platform_authorizations")
    .select("status, granted_at, status_changed_at")
    .eq("host_id", hostId)
    .eq("capability", capability);
  const rows = (data as { status: string; granted_at: string; status_changed_at: string | null }[]) ?? [];
  if (rows.length === 0) return false;
  const latest = rows.reduce((a, b) =>
    new Date(b.status_changed_at ?? b.granted_at) > new Date(a.status_changed_at ?? a.granted_at) ? b : a
  );
  return latest.status === "authorized";
}

/** The real Guide Toolkit gate: role alone ("profiles.role === 'guide'")
 *  is NOT sufficient Guide permission on its own -- it must also carry an
 *  active certification standing AND an explicit, currently-authorized
 *  'toolkit' platform-authorization row. Before this, app/toolkit/layout.tsx
 *  checked role alone; an audit (Guide Operations Agent build) found a live
 *  profiles row with role='guide' and NO guide_certifications record at
 *  all, which that check would have let into the entire Guide Toolkit.
 *  guide_platform_authorizations's 'toolkit' capability already exists in
 *  the schema for exactly this purpose and was simply never read -- this
 *  wires it in as the smallest additive correction, per the Guide
 *  Operations Agent build instruction's item 4 ("role alone when explicit
 *  authorization is required"). It only ever narrows access versus the
 *  previous check; it never widens it. */
export async function isGuideToolkitAuthorized(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [guide, standingActive, toolkitAuthorized] = await Promise.all([
    isGuide(supabase, userId),
    hasActiveCertificationStanding(supabase, userId),
    hasAuthorizedPlatformCapability(supabase, userId, "toolkit"),
  ]);
  return guide && standingActive && toolkitAuthorized;
}

/** The Guided Journey Facilitation gate -- same reasoning as
 *  isGuideToolkitAuthorized, for the separate 'guided_journey_facilitation'
 *  capability that specifically covers facilitating a CAT/InnerCompass
 *  conversation on a Host's behalf (see isAuthorizedGuideConversation
 *  below, the only caller). Kept as its own function rather than folded
 *  into isGuideToolkitAuthorized because the two capabilities are
 *  deliberately separate in guide_platform_authorizations and must not be
 *  collapsed into one check. */
export async function isGuideJourneyFacilitationAuthorized(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const [guide, standingActive, journeyAuthorized] = await Promise.all([
    isGuide(supabase, userId),
    hasActiveCertificationStanding(supabase, userId),
    hasAuthorizedPlatformCapability(supabase, userId, "guided_journey_facilitation"),
  ]);
  return guide && standingActive && journeyAuthorized;
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
 *  requires an active-standing, Guided-Journey-Facilitation-authorized
 *  Guide (isGuideJourneyFacilitationAuthorized -- see its own comment) AND
 *  an actual guide_sessions row tying this exact conversation to this
 *  exact Guide. This is the narrow exception /api/conversation and
 *  /api/referral check before falling back to their ordinary isMember()
 *  gate: it only ever unlocks a conversation the Guide's own Toolkit
 *  already created and owns, never an arbitrary Host's conversation.
 *
 *  Guide Operations Agent correction: this previously called isGuide()
 *  alone -- a pure profiles.role check -- despite its own comment already
 *  claiming it never grants access "on the strength of role alone." An
 *  audit found that claim wasn't actually enforced in code. Swapped to
 *  isGuideJourneyFacilitationAuthorized so certification standing and the
 *  explicit 'guided_journey_facilitation' platform authorization are both
 *  required, matching what the comment always intended. */
export async function isAuthorizedGuideConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const [authorized, session] = await Promise.all([
    isGuideJourneyFacilitationAuthorized(supabase, userId),
    supabase
      .from("guide_sessions")
      .select("id")
      .eq("guide_id", userId)
      .eq("conversation_id", conversationId)
      .limit(1)
      .maybeSingle(),
  ]);
  return authorized && !!session.data;
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
