import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, unsaidSystemPrompt } from "@/lib/engine/prompts";
import { toAnthropicMessages } from "@/lib/engine/conversation";
import { loadUnsaidMessages } from "@/lib/engine/unsaid";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;
  const message: string = (body?.message ?? "").toString().trim();
  const wantsResponse: boolean = body?.wantsResponse === true;
  if (!conversationId || !message) {
    return NextResponse.json({ error: "Missing conversation or message." }, { status: 400 });
  }

  const { data: convo } = await supabase
    .from("unsaid_conversations")
    .select("id, recipient, grounding, status")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "This conversation is complete." }, { status: 409 });
  }

  const crisis = detectCrisis(message);
  if (crisis) {
    await supabase.from("crisis_events").insert({ host_id: user.id, conversation_id: null });
  }

  await supabase.from("unsaid_messages").insert({
    conversation_id: conversationId,
    host_id: user.id,
    role: "host",
    content: message,
    wants_response: wantsResponse,
  });

  // The Host chose to just speak -- no reply is generated at all. This is
  // the default, expected path, not an error or a missing response. Crisis
  // support must still surface here exactly as it would on the response
  // path -- choosing not to hear back is never a reason to miss it.
  if (!wantsResponse) {
    return NextResponse.json(
      { heard: true },
      { headers: { "x-avaia-crisis": crisis ? "1" : "0" } }
    );
  }

  const system = unsaidSystemPrompt(convo.recipient, convo.grounding);

  const dbMessages = await loadUnsaidMessages(supabase, conversationId);
  // The seeded opening line and any prior "speak only" turns are real
  // conversational context but were never sent to the model as an
  // assistant/user exchange the way a normal reply is -- they're included
  // here as ordinary history so the model can see everything the Host has
  // said so far, exactly as toAnthropicMessages already maps host -> user,
  // guide -> assistant.
  const history = toAnthropicMessages(dbMessages);

  const client = anthropic();
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error("ANTHROPIC_API_KEY is not set in this deployment.");
        }
        const ms = client.messages.stream({
          model: AVAIA_MODEL,
          max_tokens: 1024,
          system,
          messages: history,
        });
        ms.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });
        const final = await ms.finalMessage();
        await recordAiUsage({
          hostId: user.id,
          conversationId,
          feature: "unsaid_conversation",
          stage: null,
          model: final.model,
          usage: final.usage,
        });

        if (full.trim()) {
          await supabase.from("unsaid_messages").insert({
            conversation_id: conversationId,
            host_id: user.id,
            role: "guide",
            content: full,
            wants_response: null,
          });
        }
        controller.close();
      } catch (e) {
        console.error("AVAIA 'What Still Needs to Be Said' error:", e);
        controller.enqueue(
          encoder.encode("\n\n(Something interrupted the response. Please try again.)")
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-avaia-crisis": crisis ? "1" : "0",
    },
  });
}
