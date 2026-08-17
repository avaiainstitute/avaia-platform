import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "@/lib/engine/anthropic";
import { isValidVirtueFamily, isValidVirtueElement } from "@/lib/virtues";
import { isValidSecondaryLoss } from "@/lib/institution";
import {
  AVAIA_MODEL,
  systemPromptFor,
  REFERRAL_FORMAT,
  REFERRAL_CALIBRATION_DISCIPLINE,
  SECONDARY_LOSS_DISCIPLINE,
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
import { generateCatOpening } from "@/lib/engine/openings";
import {
  formatCatReferralForInnerCompass,
  INNERCOMPASS_REFERRAL_WRAPPER,
} from "@/lib/engine/referral-presentation";
import { getCompletionSummary, type CompletionSummary } from "@/lib/engine/referral-provenance";

// The AVAIA Standard Referral generation logic -- shared between
// /api/referral (the Host's explicit "I'm ready to..." button) and
// /api/conversation (InnerCompass's conservative finish-intent detection,
// see isFinishIntent below). Extracted so both call the same function
// directly rather than one route calling the other over HTTP, per Dorian's
// explicit preference: a self-call adds a real network hop, duplicate auth,
// and a second place this logic could drift from itself.

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

// A Secondary Loss classification: the canonical category (validated
// against the ten official AVAIA Secondary Losses server-side, see the
// sanitizer below) always present, alongside an optional Host-specific
// description -- same required-but-nullable treatment as virtueArr's
// element, so the category and the Host's own language can coexist rather
// than one replacing the other. Historical referrals predate this shape
// entirely -- flat free-prose descriptions, never validated against the
// taxonomy -- and are handled by formatSecondaryLossClassifications on
// read (lib/engine/referral-provenance.ts), not by rewriting stored data.
const secondaryLossArr = {
  type: "array",
  items: {
    type: "object",
    properties: {
      category: { type: "string" },
      description: { type: ["string", "null"] },
    },
    required: ["category", "description"],
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
  secondaryLossesIdentified: secondaryLossArr,
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
  significantSecondaryLosses: secondaryLossArr,
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
function sanitizeVirtueClassifications(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const family = (item as { family?: unknown }).family;
    const element = (item as { element?: unknown }).element;
    if (typeof family !== "string" || !isValidVirtueFamily(family)) return false;
    if (element === null || element === undefined) return true;
    return typeof element === "string" && isValidVirtueElement(family, element);
  });
}

// Backstop for SECONDARY_LOSS_DISCIPLINE, the same treatment as
// sanitizeVirtueClassifications above: every {category, description}
// entry must have a category that validates against the canonical ten
// AVAIA Secondary Losses. description is free Host-specific text and
// always valid, including null. A silent drop, not an interpretive fix --
// prevents an invented or renamed category from ever reaching the stored
// referral. Applies to IAP's secondaryLossesIdentified and CAT's
// significantSecondaryLosses -- same shape, same validation, one place.
function sanitizeSecondaryLossClassifications(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const category = (item as { category?: unknown }).category;
    return typeof category === "string" && isValidSecondaryLoss(category);
  });
}

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

export type GenerateReferralResult =
  | { ok: true; done: boolean; nextStage?: Stage; summary: CompletionSummary }
  | { ok: false; error: string; status: number };

/** Generates the AVAIA Standard Referral for an active conversation, stores
 *  it, completes the conversation, and opens the next stage (if any) --
 *  everything /api/referral's POST handler used to do inline. The caller is
 *  responsible for auth, loading the conversation, and the membership
 *  check; this assumes the conversation is already known to be the caller's
 *  own and active. */
export async function generateReferral(
  supabase: SupabaseClient,
  hostId: string,
  conversation: { id: string; stage: Stage; program: Program; journeyId: string | null }
): Promise<GenerateReferralResult> {
  const { id: conversationId, stage, program, journeyId } = conversation;
  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1] ?? null;

  // Generate the AVAIA Standard Referral as structured data.
  const history = toAnthropicMessages(await loadMessages(supabase, conversationId));
  if (history[0]?.role === "assistant") history.shift();
  history.push({
    role: "user",
    content:
      "I'm ready to move forward. Using everything in this conversation, produce the AVAIA Standard Referral now as structured data. Do not address me — output only the referral fields. The Host-Voice fields must be in the HOST's own words, quoted exactly, word for word, not your paraphrase: reflectionsThatEmerged (moments where they defined themselves, named a value or longing, or discovered something); anchorStatements (their core identity, value, longing, and recognition statements); questionsWorthCarrying (open questions the Host is left holding); and, where they exist, decisionsMade and commitmentsChosen (choices the Host actually voiced). A quote must be a contiguous, unedited span of the Host's own words. Do not combine two separate sentences into one, do not remove words from the middle of a sentence, and do not smooth, correct, or lightly edit their phrasing. If a full sentence doesn't fit cleanly, choose a genuinely contiguous shorter span instead of editing a longer one down. Leave a Host-Voice array empty rather than inventing, paraphrasing, or reconstructing a quote from separate parts of what they said.",
  });

  // Carry the incoming referral (if any) into context, so fields meant to persist
  // across stages — like the conversation's title — can be reused or consciously
  // revised instead of generated fresh with no awareness of what came before.
  let system = `${systemPromptFor(stage, program)}\n\n${"=".repeat(60)}\n\n${REFERRAL_FORMAT}`;
  const { data: incoming } = await supabase
    .from("referrals")
    .select("content")
    .eq("host_id", hostId)
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

  // Last, most salient system content for every stage's referral writing --
  // see REFERRAL_CALIBRATION_DISCIPLINE's own comment in lib/engine/prompts.ts
  // for the root cause this addresses. Placed after the incoming-referral
  // block (not right after REFERRAL_FORMAT) so it stays last even when CAT
  // or InnerCompass has incoming referral context appended above.
  system += `\n\n${"=".repeat(60)}\n\n${REFERRAL_CALIBRATION_DISCIPLINE}`;

  // IAP and CAT only -- InnerCompass's schema has no secondary-loss field.
  // See SECONDARY_LOSS_DISCIPLINE's own comment in lib/engine/prompts.ts.
  if (stage === "iap" || stage === "cat") {
    system += `\n\n${"=".repeat(60)}\n\n${SECONDARY_LOSS_DISCIPLINE}`;
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
    return { ok: false, error: "Could not generate the referral. Please try again.", status: 502 };
  }

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
  if (
    stage === "iap" &&
    Array.isArray((content as { secondaryLossesIdentified?: unknown })?.secondaryLossesIdentified)
  ) {
    (content as { secondaryLossesIdentified: unknown[] }).secondaryLossesIdentified =
      sanitizeSecondaryLossClassifications(
        (content as { secondaryLossesIdentified: unknown[] }).secondaryLossesIdentified
      );
  }
  if (
    stage === "cat" &&
    Array.isArray((content as { significantSecondaryLosses?: unknown })?.significantSecondaryLosses)
  ) {
    (content as { significantSecondaryLosses: unknown[] }).significantSecondaryLosses =
      sanitizeSecondaryLossClassifications(
        (content as { significantSecondaryLosses: unknown[] }).significantSecondaryLosses
      );
  }

  const finalContent = content as Record<string, unknown>;

  // Store the referral, complete this stage, and open the next (if any).
  // conversation_id lets a 'conversation'-scope Workbook share (see
  // shared_access) identify exactly this referral, not just any referral
  // that happens to share the same from_stage name.
  const { error: insertError } = await supabase.from("referrals").insert({
    host_id: hostId,
    from_stage: stage,
    to_stage: nextStage ?? "continuity",
    content: finalContent,
    conversation_id: conversationId,
  });
  if (insertError) {
    // 23505 = unique_violation on referrals.conversation_id (see
    // supabase/migrations/0008_referrals_unique_conversation.sql). Two
    // near-simultaneous completion signals for the same conversation (a
    // typed request and a button click, or a double-submit) can both pass
    // the caller's "still active" check before either has written back --
    // the second call's insert loses the race. Treat that as success, not
    // failure: the Host's completion intent was already honored by the
    // other call. Do not create a second referral or a second next-stage
    // conversation.
    if ((insertError as { code?: string }).code === "23505") {
      const { data: existing } = await supabase
        .from("referrals")
        .select("content")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      const existingContent = (existing?.content as Record<string, unknown>) ?? finalContent;
      return {
        ok: true,
        done: !nextStage,
        nextStage: nextStage ?? undefined,
        summary: getCompletionSummary(stage, existingContent),
      };
    }
    return { ok: false, error: "Could not save the referral. Please try again.", status: 502 };
  }
  await supabase
    .from("conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", conversationId);

  // A few fields selected from the stored record for the compact live-
  // conversation completion card -- not a second generation, not a
  // Guide-role message. The full referral is readable only in Workbook's
  // Guide's Record (formatReferralFields), unaffected by this.
  const summary = getCompletionSummary(stage, finalContent);

  if (nextStage) {
    // Carry the program tag forward so IAP(defying-grief) -> CAT(defying-grief)
    // doesn't silently fall back to 'general' on the next stage.
    const opening =
      nextStage === "cat"
        ? await generateCatOpening(finalContent)
        : nextStage === "innercompass"
          ? await generateInnerCompassOpening(finalContent)
          : undefined;
    await createConversation(supabase, hostId, nextStage, opening, program, journeyId);
    return { ok: true, done: false, nextStage, summary };
  }
  return { ok: true, done: true, summary };
}
