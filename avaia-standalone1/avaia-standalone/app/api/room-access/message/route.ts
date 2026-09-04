import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import { AVAIA_MODEL, systemPromptFor, REFERRAL_HANDLED_BY_SITE, type Stage, type Program } from "@/lib/engine/prompts";
import { loadMessages, toAnthropicMessages } from "@/lib/engine/conversation";
import { extractFocus } from "@/lib/virtue-focus";
import { recordAiUsage } from "@/lib/engine/ai-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The private-processing equivalent of /api/conversation -- same engine
 *  (systemPromptFor, GUARDRAILS, the real IAP instruction set), deliberately
 *  authenticated by bearer token instead of the cookie session every other
 *  page uses. That's the whole point: this request is coming from
 *  lib/supabase/participant-client.ts's isolated session, not from the
 *  Guide's signed-in browser -- there is no cookie session to read here,
 *  and there must never be one for this route to work correctly.
 *
 *  Non-streaming (unlike /api/conversation) -- a deliberate scope choice
 *  for this first pass, not a capability gap: private processing here is a
 *  reflective detour inside a Room, not a full completable IAP/CAT/
 *  InnerCompass Journey with its own referral handoff. If that changes,
 *  this route is the place to add finish-intent/generateReferral, reusing
 *  the exact same functions /api/conversation already does. */
export async function POST(request: Request) {
  const auth = await authenticateBearer(request);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;
  const message: string = (body?.message ?? "").toString().trim();
  if (!conversationId || !message) {
    return NextResponse.json({ error: "Missing conversation or message." }, { status: 400 });
  }

  // RLS (conversations are self-only) already guarantees this row belongs
  // to this token's own user -- no separate ownership check needed here,
  // unlike the admin-client paths elsewhere in the Room feature.
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, stage, status, program")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "This conversation is complete." }, { status: 409 });
  }
  const stage = convo.stage as Stage;
  const program = convo.program as Program;

  const crisis = detectCrisis(message);
  if (crisis) {
    await supabase.from("crisis_events").insert({ host_id: userId, conversation_id: conversationId });
  }

  const { error: hostMessageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    host_id: userId,
    role: "host",
    content: message,
  });
  if (hostMessageError) {
    console.error("AVAIA room-access message error: Host message failed to persist", hostMessageError);
    return NextResponse.json({ error: "Your message couldn't be saved. Please try again." }, { status: 500 });
  }

  let system = `${systemPromptFor(stage, program, null)}\n\n${"=".repeat(60)}\n\n${REFERRAL_HANDLED_BY_SITE}`;
  const dbMessages = await loadMessages(supabase, conversationId);
  let convoMessages = dbMessages;
  if (dbMessages[0]?.role === "guide") {
    system +=
      `\n\nYou have already opened this conversation by saying: "${dbMessages[0].content}" ` +
      "The Host is now responding to that. Continue naturally from what they say -- do not greet " +
      "again, re-introduce yourself, or repeat your opening question.";
    convoMessages = dbMessages.slice(1);
  }
  const history = toAnthropicMessages(convoMessages);

  try {
    const client = anthropic();
    const resp: any = await client.messages.create({
      model: AVAIA_MODEL,
      max_tokens: 2048,
      system,
      messages: history,
    });
    await recordAiUsage({
      hostId: userId,
      conversationId,
      feature: `${stage}_conversation` as any,
      stage,
      model: resp.model,
      usage: resp.usage,
    });
    const full =
      (resp.content as Array<{ type: string; text?: string }>).find((b) => b.type === "text")?.text ?? "";
    const clean = extractFocus(full).text;
    if (clean.trim()) {
      const { error: replyError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        host_id: userId,
        role: "guide",
        content: clean,
      });
      if (replyError) console.error("AVAIA room-access message error: reply failed to persist", replyError);
    }
    return NextResponse.json({ reply: clean, crisis }, { headers: { "x-avaia-crisis": crisis ? "1" : "0" } });
  } catch (e) {
    console.error("AVAIA room-access message error:", e);
    return NextResponse.json({ error: "Something interrupted the response. Please try again." }, { status: 502 });
  }
}
