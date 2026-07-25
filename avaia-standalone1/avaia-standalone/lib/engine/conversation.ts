import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import type { Stage } from "./prompts";

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

/** Create a conversation for a stage and seed the Guide's opening line. */
export async function createConversation(
  supabase: SupabaseClient,
  hostId: string,
  stage: Stage,
  opening?: string
): Promise<DbConversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ host_id: hostId, stage })
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
