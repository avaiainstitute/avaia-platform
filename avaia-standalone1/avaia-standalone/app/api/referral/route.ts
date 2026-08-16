import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/engine/anthropic";
import { isValidVirtueFamily, isValidVirtueElement } from "@/lib/virtues";
import {
  AVAIA_MODEL,
  systemPromptFor,
  REFERRAL_FORMAT,
  INNERCOMPASS_OPENING_GENERATION,
  type Program,
  type Stage,
} from "@/lib/engine/prompts";
import {
  STAGE_ORDER,
  createConversation,
  loadMessages,
  toAnthropicMessages,
} from "@/lib/engine/conversation";
import { isMember } from "@/lib/membership";
import { generateCatOpening } from "@/lib/engine/openings";
import {
  formatCatReferralForInnerCompass,
  INNERCOMPASS_REFERRAL_WRAPPER,
} from "@/lib/engine/referral-presentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stage-specific referral schemas, following the AVAIA orchestration doc. Each
// stage carries the fields that stage's referral is meant to preserve. All fields
// are required so the structured output is reliable; the model uses empty arrays
// or brief strings where a field doesn't apply. IAP_REFERRAL_SCHEMA and
// CAT_REFERRAL_SCHEMA both use this helper unchanged -- IC_REFERRAL_SCHEMA
// does not (see its own definition below), so InnerCompass-specific
// optionality never touches IAP/CAT's required-field behavior.
const str = { type: "string" } as const;
const strArr = { type: "array", items: { type: "string" } } as const;

// A Chemistry of Virtue classification: the family always present, the
// specific element only when genuinely warranted -- never required merely
// because the shape supports one. Validated against the canonical
// lib/virtues.ts hierarchy server-side after generation (see the sanitizer
// below), the same backstop-not-just-instruction treatment already proven
// for CAT's old family-only filter.
//
// required includes "element" deliberately, even though it may be null --
// the canonical shape is { family, element: null }, not { family } with
// element merely absent. This keeps every newly generated classification
// structurally identical whether or not an element applies, matching
// VirtueClassification in lib/engine/referral-provenance.ts. (Historical
// referrals predate this shape entirely -- flat family-name strings --
// and are handled by normalizeVirtueClassifications on read, not by
// rewriting stored data.)
const virtueArr = {
  type: "array",
  items: {
    type: "object",
    properties: {
      family: { type: "string" },
      element: { type: ["string", "null"] },
    },
    required: ["family", "element"],
    additionalProperties: false,
  },
} as const;

const schema = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const IAP_REFERRAL_SCHEMA = schema({
  hostOverview: str,
  title: str,
  currentConcern: str,
  primaryThreads: strArr,
  significantRelationships: strArr,
  internalTensions: strArr,
  strengthsAndSupports: strArr,
  listeningCues: strArr,
  areasForExploration: strArr,
  hostPriorities: strArr,
  desiredDirection: str,
  secondaryLossesIdentified: strArr,
  governingNarratives: strArr,
  anchorStatements: strArr,
  reflectionsThatEmerged: strArr,
  questionsWorthCarrying: strArr,
  nextConversationPurpose: str,
  boundariesToProtect: strArr,
});

const CAT_REFERRAL_SCHEMA = schema({
  hostOverview: str,
  title: str,
  majorUnderstandings: strArr,
  primaryLoss: str,
  significantSecondaryLosses: strArr,
  keyRecognitions: strArr,
  identityThreads: strArr,
  activeTensions: strArr,
  relevantVirtues: virtueArr,
  restorationTargets: strArr,
  councilPerspectives: strArr,
  unresolvedQuestions: strArr,
  integrationPoints: strArr,
  anchorStatements: strArr,
  reflectionsThatEmerged: strArr,
  questionsWorthCarrying: strArr,
  nextConversationPurpose: str,
  boundariesToProtect: strArr,
});

// InnerCompass gets its own bespoke schema construction rather than the
// shared schema() helper, deliberately -- "still discerning" must be
// representable honestly, without the model being mechanically forced to
// manufacture a decision, next step, or commitment that was never actually
// reached. outcomeType is the explicit, queryable signal of what actually
// happened (for future host_continuity_entries extraction and retrieval,
// not just this rendering); the four decision-specific fields are optional
// so they can be genuinely empty rather than invented, matching whichever
// outcomeType the conversation actually produced. schema() itself, and
// IAP_REFERRAL_SCHEMA/CAT_REFERRAL_SCHEMA, are unchanged -- this only
// affects InnerCompass.
const IC_REFERRAL_SCHEMA = {
  type: "object",
  properties: {
    roomIdentity: str,
    outcomeType: {
      type: "string",
      enum: [
        "decision_made",
        "direction_chosen",
        "possibilities_identified",
        "next_step_only",
        "still_discerning",
      ],
    },
    centralDecisionOrDirection: str,
    rationale: str,
    virtuesInvolved: virtueArr,
    obstacles: strArr,
    capacityConsiderations: str,
    nextStep: str,
    followUpQuestions: strArr,
    anchorStatements: strArr,
    reflectionsThatEmerged: strArr,
    questionsWorthCarrying: strArr,
    decisionsMade: strArr,
    commitmentsChosen: strArr,
    whatToPreserve: str,
    boundariesToProtect: strArr,
  },
  // Stable required core for every completion, regardless of outcome.
  // Deliberately excludes centralDecisionOrDirection, nextStep,
  // decisionsMade, commitmentsChosen -- those are optional so
  // "still_discerning" (and the other non-decision outcomes) never forces
  // fabricated content into a field named for a decision that didn't happen.
  required: [
    "roomIdentity",
    "outcomeType",
    "rationale",
    "virtuesInvolved",
    "obstacles",
    "capacityConsiderations",
    "followUpQuestions",
    "anchorStatements",
    "reflectionsThatEmerged",
    "questionsWorthCarrying",
    "whatToPreserve",
    "boundariesToProtect",
  ],
  additionalProperties: false,
} as const;

// IC_REFERRAL_SCHEMA is a bespoke object literal (readonly required tuple),
// not schema()'s return shape, so this is typed loosely enough to hold
// both -- these are JSON schema payloads handed to the Anthropic SDK as
// data, not something relying on schema()'s exact TS shape.
const SCHEMA_FOR: Record<Stage, Record<string, unknown>> = {
  iap: IAP_REFERRAL_SCHEMA,
  cat: CAT_REFERRAL_SCHEMA,
  innercompass: IC_REFERRAL_SCHEMA,
};

// Generates InnerCompass's referral-aware opening once, at the CAT ->
// InnerCompass handoff only. Independent of generateCatOpening -- same
// mechanism, deliberately separate instruction set and call. Same
// fallback-on-failure behavior. Uses formatCatReferralForInnerCompass so
// the opening line is never generated from raw referral JSON -- see that
// function's own comment for why.
async function generateInnerCompassOpening(referralContent: unknown): Promise<string | undefined> {
  try {
    const client = anthropic();
    const resp: any = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 600,
      system: INNERCOMPASS_OPENING_GENERATION,
      messages: [
        {
          role: "user",
          content: `${INNERCOMPASS_REFERRAL_WRAPPER}\n\n${formatCatReferralForInnerCompass(referralContent as Record<string, unknown>)}`,
        },
      ],
    });
    const text = (resp.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === "text"
    )?.text;
    return text?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;
  if (!conversationId) return NextResponse.json({ error: "Missing conversation." }, { status: 400 });

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, stage, status, program, journey_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "Already complete." }, { status: 409 });
  }
  const stage = convo.stage as Stage;
  const program = convo.program as Program;
  const journeyId = convo.journey_id as string | null;

  // CAT and InnerCompass are an AVAIA Membership feature; IAP stays free and
  // untouched. This backstops the /journey page's own gate against a direct call.
  if (stage !== "iap" && !(await isMember(supabase, user.id))) {
    return NextResponse.json({ error: "This conversation requires AVAIA Membership." }, { status: 403 });
  }

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1] ?? null;

  // Generate the AVAIA Standard Referral as structured data.
  const history = toAnthropicMessages(await loadMessages(supabase, conversationId));
  if (history[0]?.role === "assistant") history.shift();
  history.push({
    role: "user",
    content:
      "I'm ready to move forward. Using everything in this conversation, produce the AVAIA Standard Referral now as structured data. Do not address me — output only the referral fields. The Host-Voice fields must be in the HOST's own words, quoted as close to verbatim as possible, not your paraphrase: reflectionsThatEmerged (moments where they defined themselves, named a value or longing, or discovered something); anchorStatements (their core identity, value, longing, and recognition statements); questionsWorthCarrying (open questions the Host is left holding); and, where they exist, decisionsMade and commitmentsChosen (choices the Host actually voiced). Leave a Host-Voice array empty rather than inventing or paraphrasing.",
  });

  // Carry the incoming referral (if any) into context, so fields meant to persist
  // across stages — like the conversation's title — can be reused or consciously
  // revised instead of generated fresh with no awareness of what came before.
  let system = `${systemPromptFor(stage, program)}\n\n${"=".repeat(60)}\n\n${REFERRAL_FORMAT}`;
  const { data: incoming } = await supabase
    .from("referrals")
    .select("content")
    .eq("host_id", user.id)
    .eq("to_stage", stage)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (incoming?.content) {
    system +=
      "\n\n" +
      "=".repeat(60) +
      "\n\nINCOMING AVAIA STANDARD REFERRAL (established context — reuse or consciously revise carried-forward fields such as the title; never replace them with no acknowledgment):\n\n" +
      JSON.stringify(incoming.content, null, 2);
    const boundaries = (incoming.content as { boundariesToProtect?: unknown })?.boundariesToProtect;
    if (Array.isArray(boundaries) && boundaries.length > 0) {
      system +=
        "\n\n" +
        "=".repeat(60) +
        "\n\nHOST-ESTABLISHED BOUNDARIES CARRIED FORWARD (see this stage's own boundary-protection instructions above for how to handle a reference, an approach, or a reopening):\n" +
        boundaries.map((b) => `- ${b}`).join("\n");
    }
  }

  let content: unknown;
  try {
    const client = anthropic();
    // output_config.format constrains the response to the referral schema.
    // Typed as any because output_config isn't in this SDK version's create() types.
    const params: any = {
      model: AVAIA_MODEL,
      max_tokens: 4096,
      system,
      messages: history,
      output_config: { format: { type: "json_schema", schema: SCHEMA_FOR[stage] } },
    };
    const resp: any = await client.messages.create(params);
    const text = (resp.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === "text"
    )?.text;
    content = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: "Could not generate the referral. Please try again." },
      { status: 502 }
    );
  }

  // Backstop for CAT_REFERRAL_VIRTUE_DISCIPLINE / INNERCOMPASS_VIRTUE_
  // DISCIPLINE: every {family, element} entry must validate against the
  // canonical lib/virtues.ts hierarchy -- family is one of the ten official
  // names, and element (when present) genuinely belongs to that family, not
  // just to the Chemistry of Virtue in general. A silent drop, not an
  // interpretive fix -- the model is responsible for making the connection
  // correctly; this only prevents an invented family, a misplaced element,
  // or a non-Chemistry word (e.g. "Trust") from ever reaching the stored
  // referral. Applies to both CAT's relevantVirtues and InnerCompass's
  // virtuesInvolved -- same shape, same validation, one place.
  const sanitizeVirtueClassifications = (value: unknown): unknown[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const family = (item as { family?: unknown }).family;
      const element = (item as { element?: unknown }).element;
      if (typeof family !== "string" || !isValidVirtueFamily(family)) return false;
      if (element === null || element === undefined) return true;
      return typeof element === "string" && isValidVirtueElement(family, element);
    });
  };
  if (stage === "cat" && Array.isArray((content as { relevantVirtues?: unknown })?.relevantVirtues)) {
    (content as { relevantVirtues: unknown[] }).relevantVirtues = sanitizeVirtueClassifications(
      (content as { relevantVirtues: unknown[] }).relevantVirtues
    );
  }
  if (
    stage === "innercompass" &&
    Array.isArray((content as { virtuesInvolved?: unknown })?.virtuesInvolved)
  ) {
    (content as { virtuesInvolved: unknown[] }).virtuesInvolved = sanitizeVirtueClassifications(
      (content as { virtuesInvolved: unknown[] }).virtuesInvolved
    );
  }

  // Store the referral, complete this stage, and open the next (if any).
  // conversation_id lets a 'conversation'-scope Workbook share (see
  // shared_access) identify exactly this referral, not just any referral
  // that happens to share the same from_stage name.
  await supabase.from("referrals").insert({
    host_id: user.id,
    from_stage: stage,
    to_stage: nextStage ?? "continuity",
    content,
    conversation_id: conversationId,
  });
  await supabase
    .from("conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (nextStage) {
    // Carry the program tag forward so IAP(defying-grief) -> CAT(defying-grief)
    // doesn't silently fall back to 'general' on the next stage.
    const opening =
      nextStage === "cat"
        ? await generateCatOpening(content)
        : nextStage === "innercompass"
          ? await generateInnerCompassOpening(content)
          : undefined;
    await createConversation(supabase, user.id, nextStage, opening, program, journeyId);
    return NextResponse.json({ done: false, nextStage });
  }
  return NextResponse.json({ done: true });
}
