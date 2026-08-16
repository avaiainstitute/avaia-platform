import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type Program, type Stage } from "@/lib/engine/prompts";
import { isMember } from "@/lib/membership";
import { generateReferral } from "@/lib/engine/referral-generation";

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
  if (!conversationId) return NextResponse.json({ error: "Missing conversation." }, { status: 400 });

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, stage, status, program, journey_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (convo.status !== "active") {
    return NextResponse.json({ error: "Already complete." }, { status: 409 });
  }
  const stage = convo.stage as Stage;
  const program = convo.program as Program;
  const journeyId = convo.journey_id as string | null;

  // CAT and InnerCompass are an AVAIA Membership feature; IAP stays free and
  // untouched. This backstops the /journey page's own gate against a direct call.
  if (stage !== "iap" && !(await isMember(supabase, user.id))) {
    return NextResponse.json({ error: "This conversation requires AVAIA Membership." }, { status: 403 });
  }

  const result = await generateReferral(supabase, user.id, {
    id: conversationId,
    stage,
    program,
    journeyId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    result.done ? { done: true } : { done: false, nextStage: result.nextStage }
  );
}
