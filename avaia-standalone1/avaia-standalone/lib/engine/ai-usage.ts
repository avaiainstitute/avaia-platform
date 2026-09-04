import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Stage } from "@/lib/engine/prompts";

export type AiUsageFeature =
  | "iap_conversation"
  | "cat_conversation"
  | "innercompass_conversation"
  | "iap_referral"
  | "cat_referral"
  | "innercompass_referral"
  | "cat_opening"
  | "innercompass_opening"
  | "iap_origin_opening"
  | "unsung_heroes_recognition"
  | "unsung_heroes_conversation"
  | "chemistry_virtue_formula"
  | "transcript_cleanup"
  | "preparation_snapshot"
  | "preparation_chat"
  | "room_conversation"
  | "room_referral";

/** The subset of an Anthropic Message's `usage` field this records -- same
 *  shape whether it came from `messages.create()` directly or from
 *  `messages.stream()`'s `finalMessage()`. Loosely typed (not imported from
 *  the SDK) so call sites that already type their response as `any` (see
 *  referral-generation.ts's own comment on why) don't need a cast. */
export type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Records one completed Anthropic call as operational telemetry -- raw
 *  token counts and attribution only, never prompt/response content. Owns
 *  the service-role Supabase dependency itself so every call site only ever
 *  needs `await recordAiUsage({...})`, never its own admin-client import.
 *
 *  Never throws. A telemetry write failing must never turn a successful
 *  Host conversation into a failed one -- the error is logged (Vercel logs)
 *  and swallowed, matching the "best-effort" pattern already used elsewhere
 *  in this codebase (e.g. Library's explore-tracking). */
export async function recordAiUsage(params: {
  hostId: string | null;
  conversationId: string | null;
  feature: AiUsageFeature;
  stage: Stage | null;
  model: string;
  usage: AnthropicUsage;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_usage_events").insert({
      host_id: params.hostId,
      conversation_id: params.conversationId,
      feature: params.feature,
      stage: params.stage,
      model: params.model,
      input_tokens: params.usage.input_tokens,
      output_tokens: params.usage.output_tokens,
      cache_creation_input_tokens: params.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: params.usage.cache_read_input_tokens ?? 0,
    });
    if (error) console.error("AVAIA AI usage recording failed:", error.message);
  } catch (e) {
    console.error("AVAIA AI usage recording failed:", e);
  }
}
