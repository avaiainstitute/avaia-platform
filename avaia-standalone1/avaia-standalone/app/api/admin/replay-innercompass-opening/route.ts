import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJourney } from "@/lib/engine/conversation";
import { advanceToNextStage } from "@/lib/engine/referral-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY, admin-only testing utility. Not a general restart feature, not
 * linked from any page. Built for one purpose: let Dorian retest
 * InnerCompass's Defying Grief prompt layers (commit 22d0d27) against an
 * EXISTING, already-completed CAT referral, without touching the original
 * IAP, CAT, its one-per-conversation referral row (referrals.conversation_id
 * is unique, this never writes a second one), or the original completed
 * InnerCompass conversation.
 *
 * A single GET, no input required: finds the most recent completed
 * defying-grief CAT conversation for the signed-in admin's own account
 * ("whichever the last one is"), then does exactly what a normal CAT ->
 * InnerCompass handoff already does (the same advanceToNextStage every real
 * Journey uses), replayed against that existing referral, under a
 * brand-new, throwaway journey_id so it can never collide with the real
 * Journey's records or with getActiveConversation's one-active-row-per-host
 * assumption. The new InnerCompass conversation is created 'active', so
 * visiting /journey shows it directly, same as any real in-progress one.
 * On success this redirects straight there, no reading JSON required.
 *
 * Remove this route (and the throwaway journey/conversation/messages it
 * creates) once the test is done, per Dorian's own instruction; nothing
 * else references this file.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Please sign in first, then click the link again.", { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return new NextResponse("Admin only.", { status: 403 });
  }

  const admin = createAdminClient();

  const { data: convo } = await admin
    .from("conversations")
    .select("id, host_id, stage, status, program, youth_program")
    .eq("host_id", user.id)
    .eq("stage", "cat")
    .eq("status", "complete")
    .eq("program", "defying-grief")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!convo) {
    return new NextResponse("No completed Defying Grief CAT conversation found on your account.", { status: 404 });
  }

  const { data: referralRow } = await admin
    .from("referrals")
    .select("content")
    .eq("conversation_id", convo.id)
    .maybeSingle();
  if (!referralRow?.content) {
    return new NextResponse("That CAT conversation has no saved referral.", { status: 404 });
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
    return new NextResponse("Something went wrong generating the test conversation. Nothing was changed.", { status: 500 });
  }

  return NextResponse.redirect(new URL("/journey", request.url));
}
