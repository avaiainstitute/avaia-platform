import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/engine/anthropic";
import { AVAIA_MODEL } from "@/lib/engine/prompts";
import { recordAiUsage } from "@/lib/engine/ai-usage";
import { getActiveCandidateForHost } from "@/lib/certification";
import { getPracticeLabByKey } from "@/lib/certification-content";
import {
  PRACTICE_MESSAGE_MAX_CHARS,
  PRACTICE_SESSION_MESSAGE_CAP,
  buildHostPracticePrompt,
  hostCardFor,
  mayStartPractice,
} from "@/lib/certification-practice";
import { boundaryGatePassed } from "@/lib/ops/certification-evaluations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI Host practice. A candidate rehearses a Practice Lab against an AI playing
 * the Host. Rehearsal only: the AI plays the Host from the lab's Host Card and
 * never evaluates, scores, hints or certifies, and nothing here is evidence.
 * Gate: an open candidacy, and the lab must be open (labs open once a person has
 * recorded the Boundary Gate as met; Lab 12 Scenarios A and B are open earlier).
 * Everything stored is candidate-private (no admin policy on these tables).
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const candidate = await getActiveCandidateForHost(supabase, user.id);
  if (!candidate) return NextResponse.json({ error: "No active certification candidacy found for this account." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const message: string = (body?.message ?? "").toString().trim();
  let sessionId: string | undefined = body?.sessionId ? String(body.sessionId) : undefined;
  if (!message) return NextResponse.json({ error: "Missing message." }, { status: 400 });
  if (message.length > PRACTICE_MESSAGE_MAX_CHARS) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  let labKey: string;
  let scenario: string | null;
  if (sessionId) {
    // RLS limits this to the candidate's own sessions.
    const { data: session } = await supabase
      .from("certification_practice_sessions")
      .select("id, lab_key, scenario, ended_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session) return NextResponse.json({ error: "Practice session not found." }, { status: 404 });
    if ((session as { ended_at: string | null }).ended_at) return NextResponse.json({ error: "That practice has ended. Start a new one." }, { status: 409 });
    labKey = (session as { lab_key: string }).lab_key;
    scenario = (session as { scenario: string | null }).scenario;
  } else {
    labKey = String(body?.labKey ?? "");
    scenario = body?.scenario ? String(body.scenario) : null;
  }

  const lab = getPracticeLabByKey(labKey);
  if (!lab) return NextResponse.json({ error: "That is not a Practice Lab." }, { status: 400 });
  const gatePassed = await boundaryGatePassed(candidate.id);
  const allowed = mayStartPractice(labKey, scenario, gatePassed);
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 });
  const hostCard = hostCardFor(lab, scenario);
  if (!hostCard) return NextResponse.json({ error: "This Lab has no Host to practice with." }, { status: 400 });

  if (!sessionId) {
    const { data: created, error } = await supabase
      .from("certification_practice_sessions")
      .insert({ candidate_id: candidate.id, lab_key: labKey, scenario })
      .select("id")
      .single();
    if (error || !created) return NextResponse.json({ error: "Could not start the practice." }, { status: 500 });
    sessionId = (created as { id: string }).id;
  }

  const { data: priorRows } = await supabase
    .from("certification_practice_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  const prior = (priorRows ?? []) as { role: "candidate" | "host"; content: string }[];
  const guideCount = prior.filter((m) => m.role === "candidate").length;
  if (guideCount >= PRACTICE_SESSION_MESSAGE_CAP) {
    return NextResponse.json({ error: "This practice has reached its length limit. Start a new one." }, { status: 409 });
  }

  await supabase.from("certification_practice_messages").insert({ session_id: sessionId, role: "candidate", content: message });

  const history = [...prior, { role: "candidate" as const, content: message }].map((m) => ({
    role: m.role === "candidate" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
  const system = buildHostPracticePrompt({ labTitle: lab.title, hostCard, guideMessagesSoFar: guideCount + 1 });

  const client = anthropic();
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set in this deployment.");
        const ms = client.messages.stream({ model: AVAIA_MODEL, max_tokens: 600, system, messages: history });
        ms.on("text", (delta) => {
          full += delta;
          controller.enqueue(encoder.encode(delta));
        });
        const finalMessage = await ms.finalMessage();
        if (full.trim()) {
          await supabase.from("certification_practice_messages").insert({ session_id: sessionId, role: "host", content: full });
          if (finalMessage.usage) {
            await recordAiUsage({
              hostId: user.id,
              conversationId: null,
              feature: "certification_practice_host",
              stage: null,
              model: AVAIA_MODEL,
              usage: finalMessage.usage,
            });
          }
        }
        controller.close();
      } catch (e) {
        console.error("Certification practice error:", e);
        controller.enqueue(encoder.encode("\n\n(Something interrupted the response. Please try again.)"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-avaia-session-id": sessionId as string,
    },
  });
}
