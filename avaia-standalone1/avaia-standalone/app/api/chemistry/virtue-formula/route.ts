import { NextResponse } from "next/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { VIRTUES, VIRTUE_FAMILIES } from "@/lib/virtues";
import { supportedSuggestions } from "@/lib/virtue-formula";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, no sign-in, same posture as the rest of the Chemistry of Virtue
// page. Nothing here is saved; suggestions are generated and shown, not
// persisted anywhere.
//
// FOUNDER RULE THIS ROUTE FOLLOWS (2026-10-10, lib/virtue-formula.ts):
//   AVAIA may suggest virtue elements only when the Host's own words support them. The Host decides which elements belong, which one is
//   Primary, and which, if any, are Supporting or Balancing toward the Host's Desired Outcome.
// So this route returns SUGGESTIONS only: each is a real element plus the person's own words that point toward it. It assigns no roles, uses no
// fixed counts, pairs nothing mechanically, and never declares that an element belongs. Whatever the model returns is filtered by
// supportedSuggestions(), which drops any element not in the real table and any quote that is not actually in what the person wrote.
// The Desired Outcome is the person's own and is returned exactly as written.

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          element: { type: "string" },
          theirWords: { type: "string" },
        },
        required: ["element", "theirWords"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

// The full element list, given to the model as its only source of truth,
// same discipline as everywhere else in AVAIA: never invent a virtue that
// isn't real.
const VIRTUE_REFERENCE = VIRTUE_FAMILIES.map(
  (f) => `${f.name}: ${VIRTUES.filter((v) => v.family === f.key).map((v) => v.name).join(", ")}`
).join("\n");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!description) {
    return NextResponse.json({ error: "Name your desired outcome first." }, { status: 400 });
  }
  if (description.length > 600) {
    return NextResponse.json({ error: "That's a bit long, try a shorter description." }, { status: 400 });
  }

  const system = `A person has written, in their own words, a Desired Outcome. You may point to virtue elements from AVAIA's Chemistry of Virtue ONLY where their own words support them.

For each element you suggest, copy the exact words from what they wrote that point toward it (a short phrase, copied character for character). If their words do not support an element, do not suggest it. If their words support none, return an empty list.

Rules:
- Use ONLY element names from this official list, never invent one, never alter a name's spelling or wording:
${VIRTUE_REFERENCE}
- Do not assign roles (no Primary, Supporting, or Balancing). The person decides which elements belong and what role each plays.
- Do not pair elements as opposites or as balances of one another.
- Do not decide for them that an element belongs, and never imply any element is missing from them or that this is who they should become. These are possibilities their own words point toward, within whatever capacity they have right now.
- There is no required number of suggestions: only as many as their words genuinely support.`;

  let raw: unknown;
  try {
    const client = anthropic();
    const params: any = {
      model: AVAIA_MODEL,
      max_tokens: 768,
      system,
      messages: [{ role: "user", content: description }],
      output_config: { format: { type: "json_schema", schema: SUGGESTION_SCHEMA } },
    };
    const resp: any = await client.messages.create(params);
    await recordAiUsage({
      hostId: null,
      conversationId: null,
      feature: "chemistry_virtue_formula",
      stage: null,
      model: resp.model,
      usage: resp.usage,
    });
    const text = (resp.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === "text"
    )?.text;
    if (!text) throw new Error("No content returned.");
    raw = JSON.parse(text)?.suggestions;
  } catch {
    return NextResponse.json({ error: "Could not look for elements in your words. Please try again." }, { status: 502 });
  }

  return NextResponse.json({
    suggestions: supportedSuggestions(description, raw),
    // The Desired Outcome is the person's own words, returned exactly as written.
    desiredOutcome: description,
  });
}
