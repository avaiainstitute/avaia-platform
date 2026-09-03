import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JourneyChat from "@/components/JourneyChat";
import { loadMessages, STAGE_LABEL, type DbConversation } from "@/lib/engine/conversation";
import {
  getGuideSession,
  hasReferralForConversation,
  findConversationByJourneyStage,
  findOrCreateGuideSessionForConversation,
} from "@/lib/guide";

export const metadata = { title: "Conversations Across Time — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** The installed CAT tool. Unlike IAP, a CAT session is never started fresh
 *  from the dashboard -- it only comes into being via the IAP tool's own
 *  handoff (see app/toolkit/iap/[sessionId]/page.tsx), the same
 *  referral-driven progression every Host gets. This page never creates a
 *  conversation; it only ever finds the one the frozen engine already
 *  created. */
export default async function ToolkitCatSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const session = await getGuideSession(supabase, user.id, params.sessionId);
  if (!session) notFound();
  if (session.tool !== "cat") notFound();
  if (!session.conversation_id) {
    return (
      <div>
        <p className="label mb-3">Conversations Across Time</p>
        <h1 className="font-serif text-3xl text-ink">This session has no conversation yet.</h1>
        <p className="mt-4 text-muted">
          CAT sessions only begin as a handoff from a completed Individual Awareness Profile.
          This one doesn&rsquo;t have one attached, which shouldn&rsquo;t happen -- worth a closer
          look.
        </p>
        <Link href="/toolkit" className="mt-6 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { data: convoData } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", session.conversation_id)
    .maybeSingle();
  const convo = convoData as DbConversation | null;
  if (!convo) notFound();

  if (convo.status === "complete") {
    const referralSaved = await hasReferralForConversation(supabase, convo.id);
    const innerConvo = convo.journey_id
      ? await findConversationByJourneyStage(supabase, convo.journey_id, "innercompass")
      : null;

    let continueHref: string | null = null;
    if (innerConvo) {
      const innerSessionId = await findOrCreateGuideSessionForConversation(
        supabase,
        user.id,
        session.participant_id,
        "innercompass",
        innerConvo.id,
        session.program,
        session.session_context
      );
      continueHref = `/toolkit/innercompass/${innerSessionId}`;
    }

    return (
      <div>
        <p className="label mb-3">Conversations Across Time</p>
        <h1 className="font-serif text-3xl text-ink">This session&rsquo;s CAT is complete.</h1>
        <p className="mt-4 text-muted">
          {referralSaved
            ? "The referral has been saved to your Workbook."
            : "This conversation is marked complete, but no referral was found -- worth a closer look."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {continueHref && (
            <Link
              href={continueHref}
              className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
            >
              Continue to InnerCompass
            </Link>
          )}
          <Link
            href="/workbook"
            prefetch={false}
            className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            View Guide&rsquo;s Record
          </Link>
          <Link
            href="/toolkit"
            className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const rawMessages = await loadMessages(supabase, convo.id);
  const messages = rawMessages.map((m) => ({ role: m.role, content: m.content }));

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <JourneyChat
        key={convo.id}
        conversationId={convo.id}
        stageLabel={STAGE_LABEL[convo.stage]}
        nextStageLabel={STAGE_LABEL.innercompass}
        isLast={false}
        initialMessages={messages}
        program={convo.program}
        participantId={session.participant_id}
      />
    </div>
  );
}
