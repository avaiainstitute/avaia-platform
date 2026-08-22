import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import JourneyChat from "@/components/JourneyChat";
import MembershipCheckoutButton from "@/components/MembershipCheckoutButton";
import DefyingGriefCrossing from "@/components/DefyingGriefCrossing";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  getActiveConversation,
  createConversation,
  createJourney,
  loadMessages,
} from "@/lib/engine/conversation";
import { getIncomingRoomTitle } from "@/lib/defying-grief";
import type { Program, Stage } from "@/lib/engine/prompts";

export const metadata = { title: "Your Journey — AVAIA" };
export const dynamic = "force-dynamic";

export default async function JourneyPage({
  searchParams,
}: {
  searchParams?: { new?: string; checkout?: string; program?: string; enter?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/journey");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("consent_at, membership_status")
    .eq("id", user.id)
    .maybeSingle();

  // A real query error (missing column, RLS misconfiguration, etc.) must
  // never be treated as "not consented" — that's exactly how the
  // membership_status column being missing on the live database turned into
  // an apparent /journey<->/welcome redirect loop: the error was silently
  // discarded, profile came back null, and the code assumed no consent
  // rather than surfacing the real problem.
  if (profileError) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Something&rsquo;s wrong</p>
        <h1 className="font-serif text-4xl text-ink">We couldn&rsquo;t load your profile</h1>
        <p className="mt-4 text-lg text-muted">
          This is a server-side problem, not something to retry your way past. Please let AVAIA
          know what happened.
        </p>
        <p className="mt-3 text-xs text-muted/70">Details: {profileError.message}</p>
      </div>
    );
  }

  if (!profile?.consent_at) redirect("/welcome");
  const isMember = profile.membership_status === "member";

  // Resolve the conversation to show: the active one, or open IAP on first entry.
  let convo = await getActiveConversation(supabase, user.id);

  // "Begin again" — start a brand-new journey with a fresh IAP conversation,
  // no matter what stage (or which leftover active conversation) the Host was
  // last in. If something's still marked active, archive it as complete first
  // so it stops being picked up as "the" active conversation, then create a
  // clean IAP conversation. Redirect to a clean URL so a refresh doesn't spawn
  // another empty conversation.
  if (searchParams?.new === "1") {
    // One complimentary IAP per Host: once a non-member has already completed
    // an IAP, this must not let them begin another one -- that would silently
    // archive whatever CAT/InnerCompass conversation is already waiting for
    // them behind the membership gate. A member is never restricted here.
    if (!isMember) {
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("host_id", user.id)
        .eq("stage", "iap")
        .eq("status", "complete");
      if ((count ?? 0) > 0) redirect("/journey");
    }

    const requestedProgram: Program =
      searchParams?.program === "defying-grief" ? "defying-grief" : "general";
    if (convo) {
      await supabase
        .from("conversations")
        .update({ status: "complete", completed_at: new Date().toISOString() })
        .eq("id", convo.id);
    }
    // A fresh IAP entered here always begins a new Journey -- never reuses
    // an existing journey_id, even if one was active a moment ago.
    const newJourneyId = await createJourney(supabase, user.id, requestedProgram);
    await createConversation(supabase, user.id, "iap", undefined, requestedProgram, newJourneyId);
    redirect("/journey");
  }

  let journeyComplete = false;
  if (!convo) {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("host_id", user.id);
    if ((count ?? 0) === 0) {
      const firstJourneyId = await createJourney(supabase, user.id, "general");
      convo = await createConversation(supabase, user.id, "iap", undefined, "general", firstJourneyId);
    } else {
      journeyComplete = true;
    }
  }

  // showRestart is false only for the membership gate below -- a non-member
  // sitting there has nothing "Start a new conversation" could meaningfully
  // do for them now (see the ?new=1 guard above), so the link isn't offered.
  const header = renderHeader(true);

  if (journeyComplete || !convo) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        {header}
        <h1 className="mt-8 font-serif text-4xl text-ink">Your journey, so far</h1>
        <p className="mt-4 text-lg text-muted">
          You&rsquo;ve walked through Awareness, Understanding, and Agency. Everything is saved
          to your Workbook, and you can return anytime to continue.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/workbook"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Open your Workbook
          </Link>
          <Link
            href="/journey?new=1"
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Begin a new journey
          </Link>
        </div>
      </div>
    );
  }

  const stage = convo.stage as Stage;

  // The free IAP experience is complete and untouched — but Conversations
  // Across Time (and everything after it) is a membership feature. A free
  // Host who has just been carried into CAT sees the membership gate instead
  // of the chat; a member continues exactly as before.
  if (stage !== "iap" && !isMember) {
    return <MembershipGate header={renderHeader(false)} checkout={searchParams?.checkout} />;
  }

  const rawMessages = await loadMessages(supabase, convo.id);

  // Defying Grief's crossing screens (entering CAT, entering InnerCompass) —
  // shown exactly once, before the Host's first message in the new stage.
  // rawMessages.length === 1 means only the seeded opening line exists yet;
  // the moment they send a message this condition is permanently false on
  // its own, so ?enter=1 only has to carry them past it the first time.
  if (
    convo.program === "defying-grief" &&
    stage !== "iap" &&
    rawMessages.length === 1 &&
    searchParams?.enter !== "1"
  ) {
    const roomTitle = await getIncomingRoomTitle(supabase, user.id, stage);
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        {header}
        <DefyingGriefCrossing stage={stage} roomTitle={roomTitle} />
      </div>
    );
  }

  const messages = rawMessages.map((m) => ({ role: m.role, content: m.content }));
  const currentIdx = STAGE_ORDER.indexOf(stage);
  // What the completion card should say this stage's referral goes to --
  // the next stage's own label, or "Continuity" for InnerCompass, the last
  // stage in STAGE_ORDER, matching to_stage: 'continuity' already used for
  // its referral row. STAGE_LABEL is server-only, so this is resolved
  // here and passed down as a plain string prop.
  const nextStageLabel = STAGE_ORDER[currentIdx + 1]
    ? STAGE_LABEL[STAGE_ORDER[currentIdx + 1]]
    : "Continuity";

  // Welcome the Host back when they're resuming — they've already engaged (more
  // than the opener) and the last activity was a while ago, not an active session.
  const lastAt = rawMessages[rawMessages.length - 1]?.created_at;
  const returning =
    rawMessages.some((m) => m.role === "host") &&
    lastAt !== undefined &&
    Date.now() - new Date(lastAt).getTime() > 2 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      {header}

      {/* Stage progress */}
      <ol className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1">
        {STAGE_ORDER.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                i === currentIdx
                  ? "font-sans text-xs font-semibold uppercase tracking-wide text-seal"
                  : i < currentIdx
                    ? "font-sans text-xs uppercase tracking-wide text-muted line-through"
                    : "font-sans text-xs uppercase tracking-wide text-muted/60"
              }
            >
              {STAGE_LABEL[s]}
            </span>
            {i < STAGE_ORDER.length - 1 && <span className="text-muted">→</span>}
          </li>
        ))}
      </ol>

      <h1 className="mt-6 font-serif text-3xl text-ink">{STAGE_LABEL[stage]}</h1>

      {returning && (
        <div className="mt-6 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4">
          <p className="font-serif text-lg text-seal">Welcome back.</p>
          <p className="mt-1 text-sm text-ink">
            When we last spoke, we were in {STAGE_LABEL[stage]} — your conversation is right below,
            just where you left it. Take a moment to read back over it if you like, then continue
            whenever you&rsquo;re ready. There&rsquo;s no need to start over.
          </p>
        </div>
      )}

      <JourneyChat
        key={convo.id}
        conversationId={convo.id}
        stageLabel={STAGE_LABEL[stage]}
        nextStageLabel={nextStageLabel}
        isLast={stage === "innercompass"}
        initialMessages={messages}
        program={convo.program}
      />
    </div>
  );
}

/** The page header, with "Start a new conversation" shown except on the
 *  membership gate -- see the ?new=1 guard above for why that link has
 *  nothing meaningful to do for a non-member sitting there. */
function renderHeader(showRestart: boolean) {
  return (
    <div className="flex items-baseline justify-between">
      <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
        AVAIA
      </Link>
      <div className="flex items-center gap-4">
        {showRestart && (
          <Link
            href="/journey?new=1"
            className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
          >
            Start a new conversation
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}

/** Shown to a free Host whose IAP is complete and who has been carried into
 *  CAT — Conversations Across Time (and InnerCompass after it) are an AVAIA
 *  Membership feature. Their referral and IAP conversation are already saved;
 *  checkout just unlocks continuing into the conversation waiting for them. */
export function MembershipGate({
  header,
  checkout,
  returnTo,
}: {
  header: React.ReactNode;
  checkout?: string;
  /** Where Stripe should send the Host back to after checkout — defaults to
   *  /journey if omitted. Defying Grief passes "/defying-grief" so a Host
   *  who pays from there lands back where they actually were, not on the
   *  general Journey page. */
  returnTo?: string;
}) {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      {header}
      <h1 className="mt-8 font-serif text-4xl text-ink">Continue your journey</h1>
      <p className="mt-4 text-lg text-muted">
        Your Individual Awareness Profile is complete — that first step is free, and it&rsquo;s
        yours to keep. Conversations Across Time and InnerCompass, where understanding turns into
        discernment, are part of AVAIA Membership.
      </p>
      <p className="mt-4 text-lg text-muted">
        Your referral is saved and waiting. Join to continue exactly where you left off.
      </p>
      {checkout === "cancelled" && (
        <p className="mt-4 text-sm text-muted">Checkout was cancelled — no charge was made.</p>
      )}
      {checkout === "success" && (
        <p className="mt-4 text-sm text-muted">
          Payment received — if your membership isn&rsquo;t reflected yet, refresh in a moment.
        </p>
      )}
      <div className="mt-8">
        <MembershipCheckoutButton returnTo={returnTo} />
      </div>
    </div>
  );
}

