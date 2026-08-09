import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import { openai } from "@/lib/engine/openai";
import { OPENAI_IAP_MODEL, OPENAI_IAP_SYSTEM_PROMPT } from "@/lib/engine/openai-iap-prompt";
import { AVAIA_MODEL, systemPromptFor, type Stage } from "@/lib/engine/prompts";
import { loadMessages, toAnthropicMessages } from "@/lib/engine/conversation";
import { extractFocus } from "@/lib/virtue-focus";
import { isMember } from "@/lib/membership";

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

  // Load the conversation (RLS guarantees it's the Host's own) and confirm it's active.
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, stage, status")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "This conversation is complete." }, { status: 409 });
  }
  const stage = convo.stage as Stage;

  // CAT and InnerCompass are an AVAIA Membership feature; IAP stays free and
  // untouched. This backstops the /journey page's own gate against a direct call.
  if (stage !== "iap" && !(await isMember(supabase, user.id))) {
    return NextResponse.json({ error: "This conversation requires AVAIA Membership." }, { status: 403 });
  }

  // PREVIEW: IAP runs on OpenAI with a minimal, non-orchestrated prompt
  // (lib/engine/openai-iap-prompt.ts). CAT and InnerCompass below are
  // completely unchanged — same Anthropic path, same systemPromptFor, same
  // referral-continuity injection as before this branch existed.
  const usingOpenAiForIap = stage === "iap";

  // Continuity: if a referral was handed into this stage, give it to the Guide
  // as established context (the CAT/InnerCompass instructions expect this).
  // Nothing ever hands a referral into IAP, so this is skipped on that path.
  let system = usingOpenAiForIap ? OPENAI_IAP_SYSTEM_PROMPT : systemPromptFor(stage);
  if (!usingOpenAiForIap) {
    const { data: referral } = await supabase
      .from("referrals")
      .select("content")
      .eq("host_id", user.id)
      .eq("to_stage", stage)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (referral?.content) {
      system +=
        "\n\n" +
        "=".repeat(60) +
        "\n\nINCOMING AVAIA STANDARD REFERRAL (established context — do not ask the Host to repeat it; build from it):\n\n" +
        JSON.stringify(referral.content, null, 2);
    }
  }

  // Crisis safety net — log for oversight; the AI's guardrail handles the response.
  const crisis = detectCrisis(message);
  if (crisis) {
    await supabase
      .from("crisis_events")
      .insert({ host_id: user.id, conversation_id: conversationId });
  }

  // Persist the Host's turn, then assemble the full history for the model.
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    host_id: user.id,
    role: "host",
    content: message,
  });

  const dbMessages = await loadMessages(supabase, conversationId);
  // The scripted opener is a guide turn, but Anthropic requires the first turn
  // to be the user. Move it into the system prompt as context (so the Guide
  // knows it has already opened and doesn't greet or re-ask) rather than
  // dropping it silently.
  let convoMessages = dbMessages;
  if (dbMessages[0]?.role === "guide") {
    system +=
      `\n\nYou have already opened this conversation by saying: "${dbMessages[0].content}" ` +
      "The Host is now responding to that. Continue naturally from what they say — do not greet " +
      "again, re-introduce yourself, or repeat your opening question.";
    convoMessages = dbMessages.slice(1);
  }
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (usingOpenAiForIap) {
          if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not set in this deployment.");
          }
          const client = openai();
          const oaMessages = convoMessages.map((m) => ({
            role: m.role === "host" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          }));
          const completion = await client.chat.completions.create({
            model: OPENAI_IAP_MODEL,
            messages: [{ role: "system" as const, content: system }, ...oaMessages],
            stream: true,
          });
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        } else {
          if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error("ANTHROPIC_API_KEY is not set in this deployment.");
          }
          const client = anthropic();
          const history = toAnthropicMessages(convoMessages);
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
          await ms.finalMessage();
        }

        // Persist the reply WITHOUT the focus marker — it's a UI signal, not
        // part of the transcript the Host or Workbook should ever see.
        const clean = extractFocus(full).text;
        if (clean.trim()) {
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            host_id: user.id,
            role: "guide",
            content: clean,
          });
        }
        controller.close();
      } catch (e) {
        // Logged for us (Vercel logs); the Host sees a calm, generic message.
        console.error("AVAIA conversation error:", e);
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
