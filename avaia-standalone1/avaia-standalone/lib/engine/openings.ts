import "server-only";
import { anthropic } from "@/lib/engine/anthropic";
import {
  AVAIA_MODEL,
  CAT_OPENING_GENERATION,
  IAP_ORIGIN_OPENING_GENERATION,
  YOUTH_OPENING_ADAPTATION,
  youthOpeningBandNote,
  type Program,
  type DevelopmentalBand,
  type OriginContextInput,
} from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";

// Generates the opening line for a brand-new IAP conversation that carries
// origin context (a Chemistry element or View From Above class the Host
// just clicked through from) -- mirrors generateCatOpening's exact
// mechanism (a live, one-shot generation, falling back to undefined --
// which leaves createConversation's own STAGE_OPENING.iap default in
// place -- on any failure, never blocking conversation creation).
export async function generateIapOriginOpening(
  origin: OriginContextInput,
  hostId?: string | null,
  conversationId?: string | null
): Promise<string | undefined> {
  try {
    const client = anthropic();
    const resp: any = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 300,
      system: IAP_ORIGIN_OPENING_GENERATION,
      messages: [
        {
          role: "user",
          content: `Origin context:\n\n${JSON.stringify(origin, null, 2)}`,
        },
      ],
    });
    await recordAiUsage({
      hostId: hostId ?? null,
      conversationId: conversationId ?? null,
      feature: "iap_origin_opening",
      stage: "iap",
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
//
// program/developmentalBand are optional and additive -- every existing
// caller that doesn't pass them (e.g. the GPT-handoff endpoint, which never
// touches Youth) behaves exactly as before. When program === "youth", the
// system prompt gets the same developmental-adaptation layer already
// governing the rest of that Youth conversation (see YOUTH_OPENING_
// ADAPTATION's own comment) -- CAT_OPENING_GENERATION itself is untouched
// for every program, including Youth.
export async function generateCatOpening(
  referralContent: unknown,
  hostId?: string | null,
  conversationId?: string | null,
  program?: Program,
  developmentalBand?: DevelopmentalBand | null
): Promise<string | undefined> {
  try {
    const client = anthropic();
    const system =
      program === "youth"
        ? `${CAT_OPENING_GENERATION}\n\n${"=".repeat(60)}\n\n${youthOpeningBandNote(developmentalBand ?? null)}\n\n${YOUTH_OPENING_ADAPTATION}`
        : CAT_OPENING_GENERATION;
    const resp: any = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 600,
      system,
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
