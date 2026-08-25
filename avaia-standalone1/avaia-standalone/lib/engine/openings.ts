import "server-only";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, CAT_OPENING_GENERATION } from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";

// Generates CAT's referral-aware opening once, at the IAP -> CAT handoff.
// Falls back to the static STAGE_OPENING.cat line (createConversation's
// existing behavior when opening is undefined) on any failure, so a
// transient generation error never blocks the handoff. Shared by the normal
// website flow (app/api/referral/route.ts) and the GPT-handoff endpoint
// (app/api/gpt-actions/iap-referral/route.ts) -- moved here, out of either
// route file, because a Next.js route.ts file may only export recognized
// route names (GET, POST, dynamic, ...); an arbitrary export from one route
// file imported into another can fail the build. hostId/conversationId are
// for AI-usage attribution only (see lib/engine/ai-usage.ts) -- optional so
// this stays callable even if a future caller doesn't have them.
export async function generateCatOpening(
  referralContent: unknown,
  hostId?: string | null,
  conversationId?: string | null
): Promise<string | undefined> {
  try {
    const client = anthropic();
    const resp: any = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 600,
      system: CAT_OPENING_GENERATION,
      messages: [
        {
          role: "user",
          content: `Here is the incoming AVAIA Standard Referral:\n\n${JSON.stringify(referralContent, null, 2)}`,
        },
      ],
    });
    await recordAiUsage({
      hostId: hostId ?? null,
      conversationId: conversationId ?? null,
      feature: "cat_opening",
      stage: "cat",
      model: resp.model,
      usage: resp.usage,
    });
    const text = (resp.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === "text"
    )?.text;
    return text?.trim() || undefined;
  } catch {
    return undefined;
  }
}
