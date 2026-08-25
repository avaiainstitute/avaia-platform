import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, unsungHeroesSystemPrompt, type UnsungHeroesPath } from "@/lib/engine/prompts";
import { toAnthropicMessages } from "@/lib/engine/conversation";
import { loadUnsungHeroesMessages } from "@/lib/engine/unsung-heroes";
import { VIRTUES, VIRTUE_FAMILIES, type VirtueFamilyKey } from "@/lib/virtues";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXT_TYPES = ["school", "community", "family"] as const;
type ContextType = (typeof CONTEXT_TYPES)[number];

// Workbook entry, not a recognition card — see the migration's own comment
// for why. The questions this shape answers (see the Instructions in
// prompts.ts) are the actual point; the virtue names are how one of those
// questions gets answered, not the center of the record.
const RECOGNITION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    whoBecameVisible: { type: "string" },
    story: { type: "string" },
    virtueFamily: { type: "string", enum: VIRTUE_FAMILIES.map((f) => f.key) },
    primaryVirtue: { type: "string" },
    supportingVirtues: { type: "array", items: { type: "string" } },
    reflection: { type: "string" },
    personalInsight: { type: "string" },
    communityImpact: { type: "string" },
    nextPractice: { type: "string" },
    questionsToRevisit: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "whoBecameVisible",
    "story",
    "virtueFamily",
    "primaryVirtue",
    "supportingVirtues",
    "reflection",
    "personalInsight",
    "communityImpact",
    "nextPractice",
    "questionsToRevisit",
  ],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;
  const contextType: string | undefined = body?.contextType;
  const observedUserId: string | undefined = body?.observedUserId || undefined;
  const context: Record<string, unknown> = body?.context && typeof body.context === "object" ? body.context : {};

  if (!conversationId) return NextResponse.json({ error: "Missing conversation." }, { status: 400 });
  if (!contextType || !CONTEXT_TYPES.includes(contextType as ContextType)) {
    return NextResponse.json({ error: "Missing or invalid context type." }, { status: 400 });
  }

  const { data: convo } = await supabase
    .from("unsung_heroes_conversations")
    .select("id, path, status")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "Already complete." }, { status: 409 });
  }
  const path = convo.path as UnsungHeroesPath;

  const history = toAnthropicMessages(await loadUnsungHeroesMessages(supabase, conversationId));
  if (history[0]?.role === "assistant") history.shift();
  history.push({
    role: "user",
    content:
      "I'm ready. Using everything in this conversation, produce the workbook entry now as " +
      "structured data. Do not address me — output only the fields. whoBecameVisible, story, " +
      "reflection, personalInsight, and communityImpact must stay close to the Host's own words " +
      "and only include what they actually said — never invent detail. reflection specifically " +
      "must capture why this mattered, not just what happened; personalInsight must capture what " +
      "the Host recognized about themselves, not a restatement of the story. If the conversation " +
      "never surfaced a genuine answer for nextPractice or questionsToRevisit, use an empty string " +
      "or empty array rather than inventing one.",
  });

  let content: {
    title: string;
    whoBecameVisible: string;
    story: string;
    virtueFamily: string;
    primaryVirtue: string;
    supportingVirtues: string[];
    reflection: string;
    personalInsight: string;
    communityImpact: string;
    nextPractice: string;
    questionsToRevisit: string[];
  };
  try {
    const client = anthropic();
    const params: any = {
      model: AVAIA_MODEL,
      max_tokens: 2048,
      system: unsungHeroesSystemPrompt(path),
      messages: history,
      output_config: { format: { type: "json_schema", schema: RECOGNITION_SCHEMA } },
    };
    const resp: any = await client.messages.create(params);
    await recordAiUsage({
      hostId: user.id,
      conversationId: conversationId ?? null,
      feature: "unsung_heroes_recognition",
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
    return NextResponse.json(
      { error: "Could not create the workbook entry. Please try again." },
      { status: 502 }
    );
  }

  // Virtue names are validated against the real Chemistry of Virtue rather
  // than trusted as-is — anything that doesn't match a real element in the
  // stated family is dropped rather than stored invented. virtue_elements
  // is the validated subset of primaryVirtue + supportingVirtues, kept
  // separate from those two (which stay as the model's own words) so the
  // dashboard has a clean, canonical list to work from.
  const family = content.virtueFamily as VirtueFamilyKey;
  const candidateNames = [content.primaryVirtue, ...content.supportingVirtues].filter(Boolean);
  const virtueElements = candidateNames.filter((name) =>
    VIRTUES.some((v) => v.family === family && v.name.toLowerCase() === name.toLowerCase())
  );
  const validPrimary = VIRTUES.find(
    (v) => v.family === family && v.name.toLowerCase() === content.primaryVirtue.toLowerCase()
  );

  const { data: row, error } = await supabase
    .from("recognitions")
    .insert({
      observer_id: user.id,
      observed_user_id: observedUserId ?? null,
      // Traces this recognition back to the conversation that produced it
      // (see 0013_guide_toolkit_participant_record.sql) -- doesn't change
      // anything about this route's request/response shape or behavior.
      conversation_id: conversationId,
      title: content.title,
      who_became_visible: content.whoBecameVisible,
      story: content.story,
      virtue_family: family,
      primary_virtue: validPrimary?.name ?? null,
      supporting_virtues: content.supportingVirtues,
      virtue_elements: virtueElements,
      reflection: content.reflection,
      personal_insight: content.personalInsight,
      community_impact: content.communityImpact,
      next_practice: content.nextPractice || null,
      questions_to_revisit: content.questionsToRevisit,
      conversation_path: path,
      context_type: contextType,
      context_school: context.school ?? null,
      context_teacher: context.teacher ?? null,
      context_grade: context.grade ?? null,
      context_business: context.business ?? null,
      context_organization: context.organization ?? null,
      context_event: context.event ?? null,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: "Could not save the workbook entry." }, { status: 500 });
  }

  await supabase
    .from("unsung_heroes_conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({ recognition: row });
}
