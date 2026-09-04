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
import {
  getGuideSession,
  setGuideSessionConversation,
  hasReferralForConversation,
  findConversationByJourneyStage,
  findOrCreateGuideSessionForConversation,
} from "@/lib/guide";
import { ensureNextStageConversation } from "@/lib/engine/referral-generation";
import { resolveOriginContext } from "@/lib/engine/origin-context";
import { generateIapOriginOpening } from "@/lib/engine/openings";

export const metadata = { title: "Individual Awareness Profile — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** The installed IAP tool. Reuses the exact same engine, API routes, and
 *  JourneyChat component the public Journey uses -- nothing here is a
 *  second implementation of IAP. The only thing new is how the
 *  conversation gets found: a Guide may run several participants' IAP
 *  sessions at once, so this looks up the conversation via this specific
 *  guide_sessions row (set once, at first use) rather than
 *  getActiveConversation(), which assumes one active conversation per
 *  account -- true for an ordinary Host, not true for a Guide.
 *
 *  Completion is detected by conversation.status === "complete", NOT
 *  conversation.stage -- each stage is its own permanent conversation row
 *  (stage never changes on an existing row), so this row's stage is always
 *  "iap"; status is what changes when the referral fires. */
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
    // A View From Above session carries which of the ten classes it's
    // anchored to (session.class_context, migration 0058) -- resolved
    // here into the same structured origin context a self-directed Host
    // gets from the public page, so the Guide-facilitated private
    // conversation opens the same way regardless of entry path.
    const origin =
      session.program === "view-from-above" ? resolveOriginContext("view-from-above", session.class_context ?? undefined) : null;
    const journeyId = await createJourney(supabase, user.id, session.program);
    const originOpening = origin ? await generateIapOriginOpening(origin, user.id, null) : undefined;
    const convo = await createConversation(
      supabase,
      user.id,
      "iap",
      originOpening,
      session.program,
      journeyId,
      origin
    );
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

  if (convo.status === "complete") {
    const referralSaved = await hasReferralForConversation(supabase, conversationId);
    let catConvo = convo.journey_id
      ? await findConversationByJourneyStage(supabase, convo.journey_id, "cat")
      : null;
    // Self-heal a stranded handoff (referral saved, next stage never
    // created -- see ensureNextStageConversation's own comment for why
    // this can happen). No-op on the ordinary path where catConvo already
    // exists.
    if (!catConvo && referralSaved) {
      const healed = await ensureNextStageConversation(supabase, user.id, {
        id: convo.id,
        stage: "iap",
        program: convo.program,
        journeyId: convo.journey_id,
      });
      if (healed) {
        catConvo = await findConversationByJourneyStage(supabase, convo.journey_id!, "cat");
      }
    }

    let continueHref: string | null = null;
    if (catConvo) {
      const catSessionId = await findOrCreateGuideSessionForConversation(
        supabase,
        user.id,
        session.participant_id,
        "cat",
        catConvo.id,
        session.program,
        session.session_context
      );
      continueHref = `/toolkit/cat/${catSessionId}`;
    }

    return (
      <div>
        <p className="label mb-3">Individual Awareness Profile</p>
        <h1 className="font-serif text-3xl text-ink">This session&rsquo;s IAP is complete.</h1>
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
              Continue to Conversations Across Time
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
        participantId={session.participant_id}
      />
    </div>
  );
}
