import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, unsungHeroesSystemPrompt, type UnsungHeroesPath } from "@/lib/engine/prompts";
import { toAnthropicMessages } from "@/lib/engine/conversation";
import { loadUnsungHeroesMessages } from "@/lib/engine/unsung-heroes";
import { VIRTUES, VIRTUE_FAMILIES, type VirtueFamilyKey } from "@/lib/virtues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXT_TYPES = ["school", "community", "family"] as const;
type ContextType = (typeof CONTEXT_TYPES)[number];

const RECOGNITION_SCHEMA = {
  type: "object",
  properties: {
    observedName: { type: "string" },
    virtueFamily: { type: "string", enum: VIRTUE_FAMILIES.map((f) => f.key) },
    virtueName: { type: "string" },
    story: { type: "string" },
    whyItMattered: { type: "string" },
    reflection: { type: "string" },
  },
  required: ["observedName", "virtueFamily", "virtueName", "story", "whyItMattered", "reflection"],
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
      "I'm ready to create the recognition card. Using everything in this conversation, produce the " +
      "card now as structured data. Do not address me — output only the fields. story, whyItMattered, " +
      "and reflection must stay close to the Host's own words and only include what they actually said " +
      "— never invent detail. reflection specifically must capture WHY the Host noticed this, not just " +
      "what happened; if the conversation never surfaced that, use the clearest true answer implied by " +
      "what they said rather than inventing one.",
  });

  let content: {
    observedName: string;
    virtueFamily: string;
    virtueName: string;
    story: string;
    whyItMattered: string;
    reflection: string;
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
    const text = (resp.content as Array<{ type: string; text?: string }>).find(
      (b) => b.type === "text"
    )?.text;
    if (!text) throw new Error("No content returned.");
    content = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Could not create the recognition card. Please try again." },
      { status: 502 }
    );
  }

  // virtue_name is validated against the Chemistry of Virtue rather than trusted
  // as-is — if the model's word doesn't match a real element in that family, we
  // keep the family (still meaningful) and drop the element rather than store an
  // invented one.
  const family = content.virtueFamily as VirtueFamilyKey;
  const validElement = VIRTUES.find(
    (v) => v.family === family && v.name.toLowerCase() === content.virtueName.toLowerCase()
  );

  const { data: row, error } = await supabase
    .from("recognitions")
    .insert({
      observer_id: user.id,
      observed_name: content.observedName,
      observed_user_id: observedUserId ?? null,
      virtue_family: family,
      virtue_name: validElement?.name ?? null,
      story: content.story,
      why_it_mattered: content.whyItMattered,
      reflection: content.reflection,
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
    return NextResponse.json({ error: "Could not save the recognition." }, { status: 500 });
  }

  await supabase
    .from("unsung_heroes_conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", conversationId);

  return NextResponse.json({ recognition: row });
}
