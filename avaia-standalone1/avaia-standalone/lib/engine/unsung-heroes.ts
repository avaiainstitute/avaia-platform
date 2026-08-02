import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  UNSUNG_HEROES_PATH_OPENING,
  type UnsungHeroesPath,
} from "./prompts";

// A parallel record to lib/engine/conversation.ts's DbConversation/DbMessage,
// backed by unsung_heroes_conversations/unsung_heroes_messages — kept fully
// separate so nothing here touches the core Journey's tables or logic.

export type UnsungHeroesMessage = {
  id: string;
  conversation_id: string;
  role: "host" | "guide";
  content: string;
  created_at: string;
};

export type UnsungHeroesConversation = {
  id: string;
  host_id: string;
  path: UnsungHeroesPath;
  status: "active" | "complete";
  created_at: string;
  completed_at: string | null;
};

/** The Host's current active Unsung Heroes conversation, if any (most recent). */
export async function getActiveUnsungHeroesConversation(
  supabase: SupabaseClient,
  hostId: string
): Promise<UnsungHeroesConversation | null> {
  const { data } = await supabase
    .from("unsung_heroes_conversations")
    .select("*")
    .eq("host_id", hostId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as UnsungHeroesConversation) ?? null;
}

/** Create an Unsung Heroes conversation for a path and seed the Guide's opener. */
export async function createUnsungHeroesConversation(
  supabase: SupabaseClient,
  hostId: string,
  path: UnsungHeroesPath
): Promise<UnsungHeroesConversation> {
  const { data, error } = await supabase
    .from("unsung_heroes_conversations")
    .insert({ host_id: hostId, path })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const convo = data as UnsungHeroesConversation;

  await supabase.from("unsung_heroes_messages").insert({
    conversation_id: convo.id,
    host_id: hostId,
    role: "guide",
    content: UNSUNG_HEROES_PATH_OPENING[path],
  });

  return convo;
}

export async function loadUnsungHeroesMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<UnsungHeroesMessage[]> {
  const { data } = await supabase
    .from("unsung_heroes_messages")
    .select("id, conversation_id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data as UnsungHeroesMessage[]) ?? [];
}
