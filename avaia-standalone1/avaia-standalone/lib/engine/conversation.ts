import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import type { Program, Stage } from "./prompts";

export const STAGE_ORDER: Stage[] = ["iap", "cat", "innercompass"];

export const STAGE_LABEL: Record<Stage, string> = {
  iap: "Individual Awareness Profile",
  cat: "Conversations Across Time",
  innercompass: "InnerCompass",
};

/** The Guide's opening line for each stage (from Dorian's instruction sets). */
export const STAGE_OPENING: Record<Stage, string> = {
  iap: "Tell me something about yourself that you would want me to know.",
  cat: "Thank you for bringing your referral forward. As you look across everything that has become visible so far, what stands out to you most right now?",
  innercompass: "Given everything you now understand, what would you like to do?",
};

export type DbMessage = {
  id: string;
  conversation_id: string;
  role: "host" | "guide";
  content: string;
  created_at: string;
};

export type DbConversation = {
  id: string;
  host_id: string;
  stage: Stage;
  status: "active" | "complete";
  program: Program;
  // Explicit Journey this conversation belongs to (see public.journeys).
  // Null means the Journey couldn't be confidently determined -- for
  // historical rows only; every conversation created from this point
  // forward is assigned one. Never guessed.
  journey_id: string | null;
  origin_context: { source: string; label: string; family: string; definition: string } | null;
  created_at: string;
  completed_at: string | null;
};

/** The Host's current active conversation, if any (most recent). */
export async function getActiveConversation(
  supabase: SupabaseClient,
  hostId: string
): Promise<DbConversation | null> {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("host_id", hostId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DbConversation) ?? null;
}

/** Starts a brand-new Journey -- call this once, at the very first IAP
 *  conversation of a Journey, and carry the returned id into every later
 *  stage's createConversation call via journeyId. A handoff between stages
 *  (IAP -> CAT -> InnerCompass) reuses the same journey_id; it does not
 *  call this again. */
export async function createJourney(
  supabase: SupabaseClient,
  hostId: string,
  program: Program = "general"
): Promise<string> {
  const { data, error } = await supabase
    .from("journeys")
    .insert({ host_id: hostId, program })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Create a conversation for a stage and seed the Guide's opening line.
 *  `program` defaults to 'general' and, once set on a Host's first (IAP)
 *  conversation, should be carried forward into every later stage so the
 *  program tag isn't lost at the IAP -> CAT -> InnerCompass handoffs.
 *  `journeyId` should be a freshly created journey (via createJourney) when
 *  starting a Journey from IAP, or the prior conversation's own journey_id
 *  when handing off to the next stage -- never a new journey at a handoff. */
export async function createConversation(
  supabase: SupabaseClient,
  hostId: string,
  stage: Stage,
  opening?: string,
  program: Program = "general",
  journeyId?: string | null,
  originContext?: { source: string; label: string; family: string; definition: string } | null
): Promise<DbConversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      host_id: hostId,
      stage,
      program,
      journey_id: journeyId ?? null,
      origin_context: originContext ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const convo = data as DbConversation;

  await supabase.from("messages").insert({
    conversation_id: convo.id,
    host_id: hostId,
    role: "guide",
    content: opening ?? STAGE_OPENING[stage],
  });

  return convo;
}

export async function loadMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<DbMessage[]> {
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as DbMessage[]) ?? [];
}

/** Map stored messages to Anthropic turns (host → user, guide → assistant). */
export function toAnthropicMessages(messages: DbMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({
    role: m.role === "host" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
}
