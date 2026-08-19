import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JourneyChat from "@/components/JourneyChat";
import {
  createJourney,
  createConversation,
  loadMessages,
  STAGE_LABEL,
  type DbConversation,
} from "@/lib/engine/conversation";
import { getGuideSession, setGuideSessionConversation, completeGuideSession, hasReferralForConversation } from "@/lib/guide";

export const metadata = { title: "Individual Awareness Profile — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** The installed IAP tool. Reuses the exact same engine, API routes, and
 *  JourneyChat component the public Journey uses -- nothing here is a
 *  second implementation of IAP. The only thing new is how the
 *  conversation gets found: a Guide may run several participants' IAP
 *  sessions at once, so this looks up the conversation via this specific
 *  guide_sessions row (set once, at first use) rather than
 *  getActiveConversation(), which assumes one active conversation per
 *  account -- true for an ordinary Host, not true for a Guide. */
export default async function ToolkitIapSessionPage({
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
  if (session.tool !== "iap") notFound();

  let conversationId = session.conversation_id;
  if (!conversationId) {
    const journeyId = await createJourney(supabase, user.id, "general");
    const convo = await createConversation(supabase, user.id, "iap", undefined, "general", journeyId);
    conversationId = convo.id;
    await setGuideSessionConversation(supabase, session.id, conversationId);
  }

  const { data: convoData } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  const convo = convoData as DbConversation | null;
  if (!convo) notFound();

  // The Host-side completion flow already moved this conversation past IAP
  // (generateReferral() creates the next-stage conversation automatically,
  // exactly as it does for any Host). CAT isn't installed in the Toolkit
  // yet, so this reports the real outcome honestly rather than trying to
  // render a stage this build doesn't support.
  if (convo.stage !== "iap") {
    if (session.status !== "complete") {
      await completeGuideSession(supabase, session.id);
    }
    const referralSaved = await hasReferralForConversation(supabase, conversationId);
    return (
      <div>
        <p className="label mb-3">Individual Awareness Profile</p>
        <h1 className="font-serif text-3xl text-ink">This session&rsquo;s IAP is complete.</h1>
        <p className="mt-4 text-muted">
          {referralSaved
            ? "The referral has been saved to your Workbook."
            : "This conversation has moved past IAP."}{" "}
          Conversations Across Time isn&rsquo;t installed in the Toolkit yet, so it isn&rsquo;t
          possible to continue this specific session further from here.
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

  const rawMessages = await loadMessages(supabase, conversationId);
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
        nextStageLabel={STAGE_LABEL.cat}
        isLast={false}
        initialMessages={messages}
        program={convo.program}
      />
    </div>
  );
}
