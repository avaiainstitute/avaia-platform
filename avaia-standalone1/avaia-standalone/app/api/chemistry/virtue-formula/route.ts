import { NextResponse } from "next/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { VIRTUES, VIRTUE_FAMILIES } from "@/lib/virtues";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, no sign-in, same posture as the rest of the Chemistry of Virtue
// page. Nothing here is saved; a formula is generated and shown, not
// persisted anywhere.
//
// FOUNDER DECISIONS THIS ROUTE FOLLOWS (2026-10-04):
//   * The governing term is DESIRED OUTCOME, and the Desired Outcome belongs to the
//     person: it is returned exactly as the person wrote it, never rewritten by the AI.
//   * The direction is: what is my desired outcome -> what virtue elements already within
//     me can I draw upon, within my capacity, toward it.
//
// OPEN FOUNDER DECISION (deliberately NOT decided here): how the virtue elements become
// visible or selected. The options under consideration are the person recognizing them,
// AVAIA/AI helping them become visible, existing established formulas, or some
// combination. Today this route has the AI choose the elements. That is the current
// behavior, isolated in this one function (the model call below), and is NOT a settled
// rule; when the Founder decides, this is the single place that changes.

const FORMULA_SCHEMA = {
  type: "object",
  properties: {
    primaryVirtue: { type: "string" },
    supportingVirtues: { type: "array", items: { type: "string" } },
    balancingVirtues: { type: "array", items: { type: "string" } },
  },
  required: ["primaryVirtue", "supportingVirtues", "balancingVirtues"],
  additionalProperties: false,
} as const;

// The full element list, given to the model as its only source of truth,
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
    return NextResponse.json({ error: "Name your desired outcome first." }, { status: 400 });
  }
  if (description.length > 600) {
    return NextResponse.json({ error: "That's a bit long, try a shorter description." }, { status: 400 });
  }

  const system = `You help a person see a Virtue Formula for AVAIA's Chemistry of Virtue: a Primary Virtue, one or more Supporting Virtues, and one or more Balancing Virtues, that together bear on the Desired Outcome the person has named.

The Desired Outcome is the person's own. Every virtue element named is already within this person, within whatever capacity they have right now; never imply that any element is missing from them, and never present the result as who they should become.

Use ONLY element names from this official list, never invent one, never alter a name's spelling or wording:
${VIRTUE_REFERENCE}

Primary Virtue: the single element most central to the outcome they named.
Supporting Virtues: elements that reinforce the primary one in this context (1-3).
Balancing Virtues: elements that balance the primary one in this context (1-2).

Every virtue name you output must exactly match an entry in the list above.`;

  let content: {
    primaryVirtue: string;
    supportingVirtues: string[];
    balancingVirtues: string[];
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
  //, same discipline as Unsung Heroes' recognition route. Anything that
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
    // The Desired Outcome is the person's own words, returned exactly as written.
    desiredOutcome: description,
  });
}
