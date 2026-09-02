import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import {
  AVAIA_MODEL,
  systemPromptFor,
  REFERRAL_HANDLED_BY_SITE,
  type Program,
  type Stage,
  type DevelopmentalBand,
} from "@/lib/engine/prompts";
import {
  formatCatReferralForInnerCompass,
  INNERCOMPASS_REFERRAL_WRAPPER,
} from "@/lib/engine/referral-presentation";
import { loadMessages, toAnthropicMessages } from "@/lib/engine/conversation";
import { extractFocus } from "@/lib/virtue-focus";
import { isMember } from "@/lib/membership";
import { isAuthorizedGuideConversation } from "@/lib/guide";
import { isFinishIntent } from "@/lib/engine/finish-intent";
import { generateReferral } from "@/lib/engine/referral-generation";
import { recordAiUsage, type AiUsageFeature } from "@/lib/engine/ai-usage";

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

  // Youth Journey, Phase 1: the developmental band lives on the Host's
  // profile, not the conversation -- only fetched for Youth, so every
  // adult/general/defying-grief message (the overwhelming majority of
  // traffic) is unaffected by an extra query.
  let developmentalBand: DevelopmentalBand | null = null;
  if (program === "youth") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("developmental_band")
      .eq("id", user.id)
      .maybeSingle();
    developmentalBand = (profile?.developmental_band as DevelopmentalBand | null) ?? null;
  }

  // CAT and InnerCompass are an AVAIA Membership feature; IAP stays free and
  // untouched. This backstops the /journey page's own gate against a direct call.
  // A Guide running this exact conversation through their own Guide Toolkit
  // session is admitted even without personal membership -- see
  // isAuthorizedGuideConversation's comment for why this stays narrow.
  if (
    stage !== "iap" &&
    !(await isMember(supabase, user.id)) &&
    !(await isAuthorizedGuideConversation(supabase, user.id, conversationId))
  ) {
    return NextResponse.json({ error: "This conversation requires AVAIA Membership." }, { status: 403 });
  }

  // Crisis safety net — log for oversight; the AI's guardrail handles the response.
  const crisis = detectCrisis(message);
  if (crisis) {
    await supabase
      .from("crisis_events")
      .insert({ host_id: user.id, conversation_id: conversationId });
  }

  // Persist the Host's turn before anything else branches on it. A failed
  // insert must stop the request here -- continuing to reply as if the
  // Host's own words were saved is the exact "looked sent, wasn't there on
  // reload" failure mode this check closes.
  const { error: hostMessageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    host_id: user.id,
    role: "host",
    content: message,
  });
  if (hostMessageError) {
    console.error("AVAIA conversation error: Host message failed to persist", hostMessageError);
    return NextResponse.json(
      { error: "Your message couldn't be saved. Please try again." },
      { status: 500 }
    );
  }

  // Convergence: the Host may type completion in ordinary language instead
  // of clicking "I'm ready to move forward" -- see lib/engine/finish-intent.ts
  // for the exact, conservative pattern set. Applies uniformly to IAP, CAT,
  // and InnerCompass. When it fires, this calls the same referral
  // generation logic the button does (generateReferral, shared with
  // /api/referral) directly, rather than sending the message to the model
  // for a normal reply -- honoring the request immediately instead of one
  // more exploratory turn first, and producing the one authoritative,
  // sanitized, calibration-disciplined record rather than a second,
  // independently-improvised one. A false negative here just falls
  // through to a normal reply; the button is always still there.
  if (isFinishIntent(message)) {
    const result = await generateReferral(supabase, user.id, {
      id: conversationId,
      stage,
      program,
      journeyId,
      developmentalBand,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: { "x-avaia-crisis": crisis ? "1" : "0" } }
      );
    }
    // result.summary is a handful of fields selected from the already-
    // stored referral, for the compact completion card only -- the full
    // referral is not persisted as a chat message and lives only in
    // Workbook's Guide's Record (see getCompletionSummary's own comment).
    return NextResponse.json(
      result.done
        ? { finished: true, done: true, summary: result.summary }
        : { finished: true, done: false, nextStage: result.nextStage, summary: result.summary },
      { headers: { "x-avaia-finished": "1", "x-avaia-crisis": crisis ? "1" : "0" } }
    );
  }

  // Continuity: if a referral was handed into this stage, give it to the Guide
  // as established context (the CAT/InnerCompass instructions expect this).
  let system = `${systemPromptFor(stage, program, developmentalBand)}\n\n${"=".repeat(60)}\n\n${REFERRAL_HANDLED_BY_SITE}`;
  const { data: referral } = await supabase
    .from("referrals")
    .select("content")
    .eq("host_id", user.id)
    .eq("to_stage", stage)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (referral?.content) {
    // InnerCompass gets the plain-language, epistemically-ordered render
    // (formatCatReferralForInnerCompass) instead of raw JSON -- see that
    // function's comment for the root cause this fixes. CAT's own
    // IAP-referral injection is untouched.
    if (stage === "innercompass") {
      system +=
        "\n\n" +
        "=".repeat(60) +
        `\n\n${INNERCOMPASS_REFERRAL_WRAPPER}\n\n` +
        formatCatReferralForInnerCompass(referral.content as Record<string, unknown>);
    } else {
      system +=
        "\n\n" +
        "=".repeat(60) +
        "\n\nINCOMING AVAIA STANDARD REFERRAL (established context — do not ask the Host to repeat it; build from it):\n\n" +
        JSON.stringify(referral.content, null, 2);
    }
    const boundaries = (referral.content as { boundariesToProtect?: unknown })?.boundariesToProtect;
    if (Array.isArray(boundaries) && boundaries.length > 0) {
      system +=
        "\n\n" +
        "=".repeat(60) +
        "\n\nHOST-ESTABLISHED BOUNDARIES CARRIED FORWARD (see this stage's own boundary-protection instructions above for how to handle a reference, an approach, or a reopening):\n" +
        boundaries.map((b) => `- ${b}`).join("\n");
    }
  }

  // Assemble the full history for the model — the Host's turn was already
  // persisted above, before the finish-intent check.
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
          conversationId,
          feature: `${stage}_conversation` as AiUsageFeature,
          stage,
          model: final.model,
          usage: final.usage,
        });

        // Persist the reply WITHOUT the focus marker — it's a UI signal, not
        // part of the transcript the Host or Workbook should ever see.
        const clean = extractFocus(full).text;
        if (clean.trim()) {
          const { error: replyError } = await supabase.from("messages").insert({
            conversation_id: conversationId,
            host_id: user.id,
            role: "guide",
            content: clean,
          });
          // The stream has already sent this text to the Host, so there's
          // nothing left to change client-side -- but a silently-failed
          // insert here is exactly what would make the reply vanish on
          // reload, so it must not go unlogged the way it did before.
          if (replyError) {
            console.error("AVAIA conversation error: reply failed to persist", replyError);
          }
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
