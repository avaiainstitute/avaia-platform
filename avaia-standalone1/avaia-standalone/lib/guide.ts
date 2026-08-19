import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolKey } from "./toolkit";
import type { DbConversation } from "./engine/conversation";
import type { Stage, Program } from "./engine/prompts";

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
