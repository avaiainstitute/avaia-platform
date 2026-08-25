import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, unsungHeroesSystemPrompt, type UnsungHeroesPath } from "@/lib/engine/prompts";
import { toAnthropicMessages } from "@/lib/engine/conversation";
import { loadUnsungHeroesMessages } from "@/lib/engine/unsung-heroes";
import { extractFocus } from "@/lib/virtue-focus";
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
  if (!conversationId || !message) {
    return NextResponse.json({ error: "Missing conversation or message." }, { status: 400 });
  }

  const { data: convo } = await supabase
    .from("unsung_heroes_conversations")
    .select("id, path, status")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "This conversation is complete." }, { status: 409 });
  }
  const path = convo.path as UnsungHeroesPath;
  let system = unsungHeroesSystemPrompt(path);

  const crisis = detectCrisis(message);
  if (crisis) {
    await supabase
      .from("crisis_events")
      .insert({ host_id: user.id, conversation_id: null });
  }

  await supabase.from("unsung_heroes_messages").insert({
    conversation_id: conversationId,
    host_id: user.id,
    role: "host",
    content: message,
  });

  const dbMessages = await loadUnsungHeroesMessages(supabase, conversationId);
  let convoMessages = dbMessages;
  if (dbMessages[0]?.role === "guide") {
    system +=
      `\n\nYou have already opened this conversation by saying: "${dbMessages[0].content}" ` +
      "The Host is now responding to that. Continue naturally from what they say — do not greet " +
      "again, re-introduce yourself, or repeat your opening question.";
    convoMessages = dbMessages.slice(1);
  }
  const history = toAnthropicMessages(convoMessages);

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
          max_tokens: 2048,
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
          conversationId: conversationId ?? null,
          feature: "unsung_heroes_conversation",
          stage: null,
          model: final.model,
          usage: final.usage,
        });

        const clean = extractFocus(full).text;
        if (clean.trim()) {
          await supabase.from("unsung_heroes_messages").insert({
            conversation_id: conversationId,
            host_id: user.id,
            role: "guide",
            content: clean,
          });
        }
        controller.close();
      } catch (e) {
        console.error("AVAIA Unsung Heroes conversation error:", e);
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
