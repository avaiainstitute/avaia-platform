import { NextResponse } from "next/server";
import { authenticateBearer } from "@/lib/supabase/bearer";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import {
  AVAIA_MODEL,
  systemPromptFor,
  REFERRAL_HANDLED_BY_SITE,
  type Stage,
  type Program,
  type DevelopmentalBand,
} from "@/lib/engine/prompts";
import { loadMessages, toAnthropicMessages } from "@/lib/engine/conversation";
import { extractFocus } from "@/lib/virtue-focus";
import { recordAiUsage } from "@/lib/engine/ai-usage";
import { isFinishIntent } from "@/lib/engine/finish-intent";
import { generateReferral } from "@/lib/engine/referral-generation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Youth band for a Room-originated private conversation lives on
 *  guide_participants.developmental_band, found via room_private_sessions,
 *  never via guide_sessions (there is none, by design, see room.ts) or
 *  profiles (this participant's auto-provisioned account has none set).
 *  Uses the admin client for this one narrow, read-only lookup, the
 *  caller has already proven ownership of conversationId via their own
 *  RLS-scoped fetch before this is ever called. */
async function resolveRoomParticipantBand(conversationId: string): Promise<DevelopmentalBand | null> {
  const admin = createAdminClient();
  const { data: rps } = await admin
    .from("room_private_sessions")
    .select("participant_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (!rps) return null;
  const { data: participant } = await admin
    .from("guide_participants")
    .select("developmental_band")
    .eq("id", rps.participant_id as string)
    .maybeSingle();
  return (participant?.developmental_band as DevelopmentalBand | null) ?? null;
}

/** The private-processing equivalent of /api/conversation, same engine
 *  (systemPromptFor, GUARDRAILS, the real IAP instruction set), deliberately
 *  authenticated by bearer token instead of the cookie session every other
 *  page uses. That's the whole point: this request is coming from
 *  lib/supabase/participant-client.ts's isolated session, not from the
 *  Guide's signed-in browser, there is no cookie session to read here,
 *  and there must never be one for this route to work correctly.
 *
 *  FINISHED (Shared Room completion, Part E): this is now a genuinely
 *  completable IAP/CAT/InnerCompass Journey, not a substitute. The same
 *  isFinishIntent/generateReferral this conversation would get through
 *  the ordinary /api/conversation route is reused verbatim here, so a
 *  participant who says "I'm ready to move forward" (or the button-driven
 *  equivalent, once the participant UI offers one) advances exactly the
 *  same way, and the resulting CAT/InnerCompass conversation is created
 *  under this same participant's own auth.uid() by createConversation,
 *  same as it always would be, still with no guide_sessions row (nothing
 *  about advancing stages creates one), so the Guide never gains any new
 *  visibility into it by continuing. */
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
  // to this token's own user, no separate ownership check needed here,
  // unlike the admin-client paths elsewhere in the Room feature.
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, stage, status, program, journey_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "This conversation is complete." }, { status: 409 });
  }
  const stage = convo.stage as Stage;
  const program = convo.program as Program;
  const journeyId = convo.journey_id as string | null;
  const developmentalBand = program === "youth" ? await resolveRoomParticipantBand(conversationId) : null;

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

  // Same convergence /api/conversation already applies: the participant
  // may type completion in ordinary language instead of a dedicated
  // button. Reuses generateReferral/advanceToNextStage exactly as-is.
  if (isFinishIntent(message)) {
    const result = await generateReferral(supabase, userId, {
      id: conversationId,
      stage,
      program,
      journeyId,
      developmentalBand,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if (result.done) {
      return NextResponse.json(
        { finished: true, done: true, summary: result.summary },
        { headers: { "x-avaia-finished": "1", "x-avaia-crisis": crisis ? "1" : "0" } }
      );
    }
    // Advancing to CAT/InnerCompass: the new stage's conversation already
    // exists (advanceToNextStage created it), resolve it here under this
    // same bearer-scoped, RLS-respecting client (auth.uid() = host_id
    // already guarantees this is this participant's own), so the private-
    // processing UI can continue chatting in the next stage without a
    // second round trip or any cookie-session page redirect, which this
    // isolated client has no equivalent of.
    const { data: nextConvo } = await supabase
      .from("conversations")
      .select("id")
      .eq("journey_id", journeyId)
      .eq("stage", result.nextStage as string)
      .maybeSingle();
    let nextOpening: string | null = null;
    if (nextConvo?.id) {
      const nextMessages = await loadMessages(supabase, nextConvo.id as string);
      nextOpening = nextMessages[0]?.content ?? null;
    }
    return NextResponse.json(
      {
        finished: true,
        done: false,
        nextStage: result.nextStage,
        nextConversationId: nextConvo?.id ?? null,
        nextOpening,
        summary: result.summary,
      },
      { headers: { "x-avaia-finished": "1", "x-avaia-crisis": crisis ? "1" : "0" } }
    );
  }

  const originContext = stage === "iap" ? convo?.origin_context ?? null : null;
  let system = `${systemPromptFor(stage, program, developmentalBand, originContext)}\n\n${"=".repeat(60)}\n\n${REFERRAL_HANDLED_BY_SITE}`;
  const dbMessages = await loadMessages(supabase, conversationId);
  let convoMessages = dbMessages;
  if (dbMessages[0]?.role === "guide") {
    system +=
      `\n\nYou have already opened this conversation by saying: "${dbMessages[0].content}" ` +
      "The Host is now responding to that. Continue naturally from what they say, do not greet " +
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
