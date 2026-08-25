import { NextResponse } from "next/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { VIRTUES, VIRTUE_FAMILIES } from "@/lib/virtues";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, no sign-in -- same posture as the rest of the Chemistry of Virtue
// page. Nothing here is saved; a formula is generated and shown, not
// persisted anywhere.

const FORMULA_SCHEMA = {
  type: "object",
  properties: {
    primaryVirtue: { type: "string" },
    supportingVirtues: { type: "array", items: { type: "string" } },
    balancingVirtues: { type: "array", items: { type: "string" } },
    desiredOutcome: { type: "string" },
  },
  required: ["primaryVirtue", "supportingVirtues", "balancingVirtues", "desiredOutcome"],
  additionalProperties: false,
} as const;

// The full element list, given to the model as its only source of truth --
// same discipline as everywhere else in AVAIA: never invent a virtue that
// isn't real. Grouped by family so the model can also reason about balance
// (e.g. pairing a Fortitude element with a Self-Control one).
const VIRTUE_REFERENCE = VIRTUE_FAMILIES.map(
  (f) => `${f.name}: ${VIRTUES.filter((v) => v.family === f.key).map((v) => v.name).join(", ")}`
).join("\n");

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!description) {
    return NextResponse.json({ error: "Describe a role or situation first." }, { status: 400 });
  }
  if (description.length > 600) {
    return NextResponse.json({ error: "That's a bit long -- try a shorter description." }, { status: 400 });
  }

  const system = `You assemble a Virtue Formula for AVAIA's Chemistry of Virtue: a Primary Virtue, one or more Supporting Virtues, and one or more Balancing Virtues, that together support a person in the role or situation they describe.

Use ONLY element names from this official list -- never invent one, never alter a name's spelling or wording:
${VIRTUE_REFERENCE}

Primary Virtue: the single element most central to what they described.
Supporting Virtues: elements that reinforce the primary one in this context (1-3).
Balancing Virtues: elements that keep the primary one from tipping into excess or imbalance -- e.g. Fortitude without a balancing element can become rigidity; Positive Attitude without one can become denial (1-2).
Desired Outcome: one sentence, in plain language, describing what this combination supports -- not a virtue name, a real-life outcome.

Every virtue name you output must exactly match an entry in the list above.`;

  let content: {
    primaryVirtue: string;
    supportingVirtues: string[];
    balancingVirtues: string[];
    desiredOutcome: string;
  };
  try {
    const client = anthropic();
    const params: any = {
      model: AVAIA_MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: "user", content: description }],
      output_config: { format: { type: "json_schema", schema: FORMULA_SCHEMA } },
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
    content = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Could not generate a formula. Please try again." }, { status: 502 });
  }

  // Validated against the real Chemistry of Virtue rather than trusted as-is
  // -- same discipline as Unsung Heroes' recognition route. Anything that
  // doesn't match a real element name is dropped rather than shown invented.
  const validNames = new Set(VIRTUES.map((v) => v.name.toLowerCase()));
  const isReal = (name: string) => validNames.has(name.toLowerCase());
  const realName = (name: string) => VIRTUES.find((v) => v.name.toLowerCase() === name.toLowerCase())!.name;

  if (!isReal(content.primaryVirtue)) {
    return NextResponse.json(
      { error: "Could not generate a valid formula. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    primaryVirtue: realName(content.primaryVirtue),
    supportingVirtues: content.supportingVirtues.filter(isReal).map(realName),
    balancingVirtues: content.balancingVirtues.filter(isReal).map(realName),
    desiredOutcome: content.desiredOutcome,
  });
}
