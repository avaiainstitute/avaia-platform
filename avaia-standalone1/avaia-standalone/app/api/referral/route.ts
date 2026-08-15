import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/engine/anthropic";
import {
  AVAIA_MODEL,
  systemPromptFor,
  REFERRAL_FORMAT,
  CAT_OPENING_GENERATION,
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stage-specific referral schemas, following the AVAIA orchestration doc. Each
// stage carries the fields that stage's referral is meant to preserve. All fields
// are required so the structured output is reliable; the model uses empty arrays
// or brief strings where a field doesn't apply.
const str = { type: "string" } as const;
const strArr = { type: "array", items: { type: "string" } } as const;

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
  relevantVirtues: strArr,
  restorationTargets: strArr,
  councilPerspectives: strArr,
  unresolvedQuestions: strArr,
  integrationPoints: strArr,
  anchorStatements: strArr,
  reflectionsThatEmerged: strArr,
  questionsWorthCarrying: strArr,
  nextConversationPurpose: str,
});

const IC_REFERRAL_SCHEMA = schema({
  centralDecisionOrDirection: str,
  rationale: str,
  virtuesInvolved: strArr,
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
  roomIdentity: str,
});

const SCHEMA_FOR: Record<Stage, ReturnType<typeof schema>> = {
  iap: IAP_REFERRAL_SCHEMA,
  cat: CAT_REFERRAL_SCHEMA,
  innercompass: IC_REFERRAL_SCHEMA,
};

// Generates CAT's referral-aware opening once, at the IAP -> CAT handoff
// only. Falls back to the static STAGE_OPENING.cat line (createConversation's
// existing behavior when opening is undefined) on any failure, so a
// transient generation error never blocks the handoff.
async function generateCatOpening(referralContent: unknown): Promise<string | undefined> {
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
    .select("id, stage, status, program")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "Already complete." }, { status: 409 });
  }
  const stage = convo.stage as Stage;
  const program = convo.program as Program;

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
    const opening = nextStage === "cat" ? await generateCatOpening(content) : undefined;
    await createConversation(supabase, user.id, nextStage, opening, program);
    return NextResponse.json({ done: false, nextStage });
  }
  return NextResponse.json({ done: true });
}
