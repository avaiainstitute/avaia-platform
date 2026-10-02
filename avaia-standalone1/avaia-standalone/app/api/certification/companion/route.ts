import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, detectCrisis } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { sendEmail } from "@/lib/resend";
import { certificationCompanionEscalationEmailHtml } from "@/lib/ops/emails";
import { getActiveCandidateForHost, getCandidateProgress, getCandidateNonEvaluativeHistory } from "@/lib/certification";
import {
  buildCandidateContextBlock,
  buildSystemPrompt,
  resolveContentForMessage,
  detectCertificationEscalation,
} from "@/lib/certification-companion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AVAIA Certification Companion chat endpoint. Mirrors /api/conversation's
 * shape (auth -> gate -> crisis check -> persist Host turn -> stream reply
 * -> persist Guide turn) with one structural difference: the gate here is
 * getActiveCandidateForHost (an open guide_candidates row), not isMember,
 * and the system prompt is assembled fresh every turn from
 * lib/certification-content.ts + the candidate's own current state rather
 * than loaded from a stored referral.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const candidate = await getActiveCandidateForHost(supabase, user.id);
  if (!candidate) {
    return NextResponse.json({ error: "No active AVAIA Guide Certification candidacy found for this account." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const message: string = (body?.message ?? "").toString().trim();
  let conversationId: string | undefined = body?.conversationId;
  const itemKey: string | null = body?.itemKey ?? null;
  if (!message) {
    return NextResponse.json({ error: "Missing message." }, { status: 400 });
  }

  // Find or create the candidate's conversation. One active conversation
  // per candidate for this smallest version -- mirrors guide_sessions'
  // find-or-create shape (lib/guide.ts's
  // findOrCreateGuideSessionForConversation), not a new pattern.
  if (!conversationId) {
    const { data: existing } = await supabase
      .from("certification_companion_conversations")
      .select("id")
      .eq("candidate_id", candidate.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      conversationId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("certification_companion_conversations")
        .insert({ candidate_id: candidate.id, host_id: user.id })
        .select("id")
        .single();
      if (error || !created) {
        return NextResponse.json({ error: "Could not start a Companion conversation." }, { status: 500 });
      }
      conversationId = created.id;
    }
  } else {
    // RLS (self all: host_id = auth.uid()) already guarantees this is the
    // candidate's own conversation; just confirm it exists and is active.
    const { data: convo } = await supabase
      .from("certification_companion_conversations")
      .select("id, status")
      .eq("id", conversationId)
      .maybeSingle();
    if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  // Crisis safety net -- identical posture to /api/conversation: a
  // conservative keyword pre-check, logged for oversight, never the only
  // thing standing between a candidate in crisis and help. Logs to the
  // existing crisis_events table (same table every other AVAIA surface
  // uses), not a new mechanism.
  const crisis = detectCrisis(message);
  if (crisis) {
    await supabase.from("crisis_events").insert({ host_id: user.id });
  }

  // Candidate/evaluator isolation happens here, structurally: this route
  // only ever imports lib/certification-content.ts (candidate-visible
  // fields only) and lib/certification.ts (self-report + non-evaluative
  // history only). There is no evaluator-only table or field reachable
  // from this file at all -- not a redaction step, an absence.
  const matchedItems = resolveContentForMessage(message, itemKey);
  const [progress, recentActivity] = await Promise.all([
    getCandidateProgress(supabase, candidate.id),
    getCandidateNonEvaluativeHistory(supabase, candidate.id),
  ]);
  const candidateContextBlock = buildCandidateContextBlock(candidate, progress, recentActivity);
  const system = buildSystemPrompt(candidateContextBlock, matchedItems);

  // Certification-specific escalation (waiver request, evaluation dispute,
  // judgment-territory question, or no confident content match) -- logged
  // independently of the crisis check above; a message can trigger both.
  const escalationCategory = detectCertificationEscalation(message, matchedItems);
  const explicitEscalation = crisis || (!!escalationCategory && escalationCategory !== "no_confident_match");
  // crisis takes priority in the logged category when both fire on the
  // same message; either way this is at most one insert per turn.
  if (crisis || escalationCategory) {
    const loggedCategory = crisis ? "crisis" : (escalationCategory as string);
    await supabase.from("certification_companion_escalations").insert({
      candidate_id: candidate.id,
      conversation_id: conversationId,
      category: loggedCategory,
      note: message.slice(0, 500),
    });
    // "no_confident_match" is a softer signal (a content question the
    // Companion just didn't match) -- logged for review, but doesn't page
    // Dorian/admin by email the way a real escalation does.
    const notifyTo = process.env.GUIDE_OPS_NOTIFICATION_EMAIL || process.env.CONTACT_NOTIFICATION_EMAIL;
    if (notifyTo && loggedCategory !== "no_confident_match") {
      await sendEmail({
        to: notifyTo,
        subject: "AVAIA Certification Companion -- escalation",
        html: certificationCompanionEscalationEmailHtml({
          category: loggedCategory,
          hostId: user.id,
          candidateId: candidate.id,
          note: message.slice(0, 500),
        }),
      }).catch((e) => console.error("Certification Companion escalation email failed:", e));
    }
  }

  // Persist the candidate's turn.
  await supabase.from("certification_companion_messages").insert({
    conversation_id: conversationId,
    role: "candidate",
    content: message,
  });

  // Conversation history for this thread (candidate/companion turns only).
  const { data: historyRows } = await supabase
    .from("certification_companion_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const history = (historyRows ?? []).map((m) => ({
    role: m.role === "candidate" ? ("user" as const) : ("assistant" as const),
    content: m.content as string,
  }));

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
          max_tokens: 1536,
          system,
          messages: history,
        });
        ms.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });
        const finalMessage = await ms.finalMessage();

        if (full.trim()) {
          await supabase.from("certification_companion_messages").insert({
            conversation_id: conversationId,
            role: "companion",
            content: full,
            model: AVAIA_MODEL,
            input_tokens: finalMessage.usage?.input_tokens ?? null,
            output_tokens: finalMessage.usage?.output_tokens ?? null,
          });
        }
        controller.close();
      } catch (e) {
        console.error("Certification Companion error:", e);
        controller.enqueue(encoder.encode("\n\n(Something interrupted the response. Please try again.)"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-avaia-crisis": crisis ? "1" : "0",
      "x-avaia-escalated": explicitEscalation ? "1" : "0",
      "x-avaia-conversation-id": conversationId as string,
    },
  });
}
