import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JourneyChat from "@/components/JourneyChat";
import { loadMessages, STAGE_LABEL, type DbConversation } from "@/lib/engine/conversation";
import { getGuideSession, hasReferralForConversation, completeGuideSession } from "@/lib/guide";

export const metadata = { title: "InnerCompass — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** The installed InnerCompass tool -- the final stage. Like CAT, this is
 *  never started fresh; it only exists as a handoff from a completed CAT
 *  session (see app/toolkit/cat/[sessionId]/page.tsx). There is no further
 *  stage to hand off to once this completes -- the Journey itself is done. */
export default async function ToolkitInnerCompassSessionPage({
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
  if (session.tool !== "innercompass") notFound();
  if (!session.conversation_id) {
    return (
      <div>
        <p className="label mb-3">InnerCompass</p>
        <h1 className="font-serif text-3xl text-ink">This session has no conversation yet.</h1>
        <p className="mt-4 text-muted">
          InnerCompass sessions only begin as a handoff from a completed Conversations Across
          Time. This one doesn&rsquo;t have one attached, which shouldn&rsquo;t happen -- worth a
          closer look.
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
    if (session.status !== "complete") {
      await completeGuideSession(supabase, session.id);
    }
    const referralSaved = await hasReferralForConversation(supabase, convo.id);

    return (
      <div>
        <p className="label mb-3">InnerCompass</p>
        <h1 className="font-serif text-3xl text-ink">This Journey is complete.</h1>
        <p className="mt-4 text-muted">
          {referralSaved
            ? "The full record has been saved to your Workbook."
            : "This conversation is marked complete, but no referral was found -- worth a closer look."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/workbook"
            prefetch={false}
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
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
        nextStageLabel="Continuity"
        isLast={true}
        initialMessages={messages}
        program={convo.program}
      />
    </div>
  );
}
