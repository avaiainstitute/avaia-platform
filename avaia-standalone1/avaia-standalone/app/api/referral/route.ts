import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type Program, type Stage } from "@/lib/engine/prompts";
import { isMember } from "@/lib/membership";
import { isAuthorizedGuideConversation } from "@/lib/guide";
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
  // Same narrow Guide exception as /api/conversation -- see
  // isAuthorizedGuideConversation's comment.
  if (
    stage !== "iap" &&
    !(await isMember(supabase, user.id)) &&
    !(await isAuthorizedGuideConversation(supabase, user.id, conversationId))
  ) {
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
  // result.summary is a handful of fields selected from the already-
  // stored referral, for the compact completion card only -- same shape a
  // typed completion request in /api/conversation returns, so the button
  // and a typed request are two ways of expressing the same action. The
  // full referral is not persisted as a chat message and lives only in
  // Workbook's Guide's Record.
  return NextResponse.json(
    result.done
      ? { done: true, summary: result.summary }
      : { done: false, nextStage: result.nextStage, summary: result.summary }
  );
}
