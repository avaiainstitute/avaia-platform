import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolKey } from "./toolkit";

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
