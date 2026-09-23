import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJourney } from "@/lib/engine/conversation";
import { advanceToNextStage } from "@/lib/engine/referral-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY, admin-only testing utility. Not a general restart feature, not
 * linked from any page, and not something a Host can reach. Built for one
 * purpose: let Dorian retest InnerCompass's Defying Grief prompt layers
 * (commit 22d0d27) against an EXISTING, already-completed CAT referral,
 * without touching the original IAP, CAT, its one-per-conversation
 * referral row (referrals.conversation_id is unique, this never writes a
 * second one), or the original completed InnerCompass conversation.
 *
 * Does exactly what a normal CAT -> InnerCompass handoff already does
 * (calls the same advanceToNextStage used by every real Journey), just
 * replayed against a referral that already exists, under a brand-new,
 * throwaway journey_id so it can never collide with the real Journey's
 * records or with getActiveConversation's one-active-row-per-host
 * assumption. The new InnerCompass conversation is created with the
 * normal 'active' status, so it becomes the Host's active conversation
 * and is reachable at /journey exactly like any other in-progress one.
 *
 * Remove this route (and the throwaway journey/conversation/messages it
 * creates) once the test is done, per Dorian's own instruction; nothing
 * else references this file.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const catConversationId: string | undefined = body?.catConversationId;
  if (!catConversationId) {
    return NextResponse.json({ error: "Missing catConversationId." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: convo } = await admin
    .from("conversations")
    .select("id, host_id, stage, status, program, youth_program")
    .eq("id", catConversationId)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: "CAT conversation not found." }, { status: 404 });
  if (convo.stage !== "cat") {
    return NextResponse.json({ error: `Conversation ${catConversationId} is stage '${convo.stage}', not 'cat'.` }, { status: 400 });
  }
  if (convo.status !== "complete") {
    return NextResponse.json({ error: "That CAT conversation is not marked complete." }, { status: 400 });
  }
  if (convo.program !== "defying-grief") {
    return NextResponse.json({ error: "This test tool is scoped to program 'defying-grief' only." }, { status: 400 });
  }

  const { data: referralRow } = await admin
    .from("referrals")
    .select("content")
    .eq("conversation_id", catConversationId)
    .maybeSingle();
  if (!referralRow?.content) {
    return NextResponse.json({ error: "No referral found for that CAT conversation." }, { status: 404 });
  }

  // A fresh, throwaway journey, never the original CAT/InnerCompass
  // conversations' own journey_id, keeps this test fully isolated.
  const testJourneyId = await createJourney(admin, convo.host_id, "defying-grief", convo.youth_program ?? null);

  const advanced = await advanceToNextStage(
    admin,
    convo.host_id,
    {
      id: convo.id,
      stage: "cat",
      program: "defying-grief",
      journeyId: testJourneyId,
      youthProgram: convo.youth_program ?? null,
    },
    referralRow.content as Record<string, unknown>
  );
  if (!advanced.nextStage) {
    return NextResponse.json({ error: "advanceToNextStage did not produce a next stage." }, { status: 500 });
  }

  const { data: newConvo } = await admin
    .from("conversations")
    .select("id, status, created_at")
    .eq("journey_id", testJourneyId)
    .eq("stage", "innercompass")
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    sourceCatConversationId: catConversationId,
    testJourneyId,
    newInnerCompassConversationId: newConvo?.id ?? null,
    status: newConvo?.status ?? null,
  });
}
