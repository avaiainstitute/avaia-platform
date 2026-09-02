import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JourneyChat from "@/components/JourneyChat";
import DefyingGriefCrossing from "@/components/DefyingGriefCrossing";
import JourneyIntro from "@/components/JourneyIntro";
import BeginFreeJourney from "@/components/BeginFreeJourney";
import SaveProgressForm from "@/components/SaveProgressForm";
import StartNewJourneyLink from "@/components/StartNewJourneyLink";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  getActiveConversation,
  createConversation,
  createJourney,
  loadMessages,
} from "@/lib/engine/conversation";
import { getIncomingRoomTitle } from "@/lib/defying-grief";
import { getIncomingSummary } from "@/lib/engine/referral-provenance";
import type { Program, Stage, DevelopmentalBand } from "@/lib/engine/prompts";
import { isMember as checkIsMember } from "@/lib/membership";
import { generateGuidesRecord } from "@/lib/engine/referral-generation";

export const metadata = { title: "Your Journey — AVAIA" };
export const dynamic = "force-dynamic";

export default async function JourneyPage({
  searchParams,
}: {
  searchParams?: { new?: string; checkout?: string; program?: string; enter?: string; saved?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Free IAP entry: a signed-out visitor is no longer redirected away.
  // BeginFreeJourney starts a real (anonymous) Supabase identity on
  // deliberate click only -- never automatically on page load -- then
  // refreshes so this Server Component re-runs with a session and falls
  // straight into the same consent -> auto-provision path below,
  // unchanged for every other caller. A signed-in Host never sees this.
  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Individual Awareness Profile</p>
        <h1 className="font-serif text-4xl text-ink">Begin your Journey</h1>
        <p className="mt-4 text-lg text-muted">
          The first step is free, and you can begin right now — no account required yet.
        </p>
        <div className="mt-8">
          <BeginFreeJourney />
        </div>
      </div>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("consent_at, minor_with_guardian")
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
  const isMember = await checkIsMember(supabase, user.id);

  // Resolve the conversation to show: the active one, or open IAP on first entry.
  let convo = await getActiveConversation(supabase, user.id);

  // "Begin again" — start a brand-new journey with a fresh IAP conversation,
  // no matter what stage (or which leftover active conversation) the Host was
  // last in. If something's still active, its Guide's Record is generated
  // and stored (see generateGuidesRecord's own comment) before a clean IAP
  // conversation is created -- deliberately NOT advanceToNextStage, so no
  // CAT/next-stage conversation is created for the Journey being left.
  // Redirect to a clean URL so a refresh doesn't spawn another empty
  // conversation.
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
      searchParams?.program === "defying-grief"
        ? "defying-grief"
        : searchParams?.program === "youth"
        ? "youth"
        : "general";

    // Same protection as the silent brand-new-Host default below (see its
    // comment for the full reasoning) -- a Host who self-identified as
    // under 18 at /welcome must not be routed into a non-Youth program even
    // via an explicit ?new=1&program=... request.
    if (profile?.minor_with_guardian && requestedProgram !== "youth") {
      redirect("/youth");
    }
    if (convo) {
      let developmentalBand: DevelopmentalBand | null = null;
      if (convo.program === "youth") {
        const { data: bandProfile } = await supabase
          .from("profiles")
          .select("developmental_band")
          .eq("id", user.id)
          .maybeSingle();
        developmentalBand = (bandProfile?.developmental_band as DevelopmentalBand | null) ?? null;
      }
      const record = await generateGuidesRecord(supabase, user.id, {
        id: convo.id,
        stage: convo.stage,
        program: convo.program,
        developmentalBand,
      });
      // Generation failed (e.g. a transient AI error) -- leave the Host's
      // current conversation untouched rather than silently losing the
      // record, and don't start a new Journey this click. Same failure
      // posture as normal completion (/api/referral), just without a
      // dedicated error screen: this falls through to the ordinary
      // /journey render, showing their still-active, still-intact
      // conversation so they can try again.
      if (!record.ok) redirect("/journey");
    }
    // A fresh IAP entered here always begins a new Journey -- never reuses
    // an existing journey_id, even if one was active a moment ago.
    const newJourneyId = await createJourney(supabase, user.id, requestedProgram);
    await createConversation(supabase, user.id, "iap", undefined, requestedProgram, newJourneyId);
    redirect("/journey");
  }

  let journeyComplete = false;
  // Carries the Host's most recent program forward for the "begin again"
  // links below (header's "Start a new conversation" and the completed-
  // journey screen's "Begin a new journey") -- so a Youth or Defying Grief
  // Host restarting doesn't silently fall back to general. When there's an
  // active conversation, its own program is already known; otherwise this
  // is resolved from the most recent conversation on record.
  let programForRestart: Program = convo?.program ?? "general";
  if (!convo) {
    const { data: mostRecentConvo } = await supabase
      .from("conversations")
      .select("id, program")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!mostRecentConvo) {
      // A Host who self-identified as under 18 at /welcome (minor_with_
      // guardian, written alongside consent_at in app/api/consent/route.ts)
      // must never be silently defaulted into the adult Defying Grief
      // engine below -- route them into the existing Youth entry/band-
      // selection pathway instead, before any Journey is created. This is
      // self-attestation only, not verified guardian consent (see /youth's
      // own migration and the Youth Production-Readiness Audit) -- it is
      // used here only to prevent a known minor from entering the adult
      // engine, never as a claim that guardian-consent architecture is
      // complete. A Host who picked "18 or older," or a legacy account
      // that predates this question, is unaffected and falls through to
      // the existing default exactly as before.
      if (profile?.minor_with_guardian) {
        redirect("/youth");
      }
      // Defying Grief is the current individual Host pathway (no separate
      // "General AVAIA Journey" is being positioned against it) -- a
      // genuinely brand-new Host's complimentary IAP is the beginning of
      // Defying Grief, tagged as such from this very first conversation so
      // the CAT Audacity layer, the InnerCompass Audacity-of-Choice layer,
      // the crossing screens, and the Workbook's Defying Grief badge all
      // apply to them the same way they already do for a Host who arrived
      // through /defying-grief's own front door. See the matching adjustment
      // to the JourneyIntro condition below, which keeps this population's
      // IAP orientation screen intact.
      const firstJourneyId = await createJourney(supabase, user.id, "defying-grief");
      convo = await createConversation(
        supabase,
        user.id,
        "iap",
        undefined,
        "defying-grief",
        firstJourneyId
      );
    } else {
      journeyComplete = true;
      programForRestart = (mostRecentConvo.program as Program) ?? "general";
    }
  }
  const restartHref =
    programForRestart === "general" ? "/journey?new=1" : `/journey?new=1&program=${programForRestart}`;

  // showRestart is false only for the membership gate below -- a non-member
  // sitting there has nothing "Start a new conversation" could meaningfully
  // do for them now (see the ?new=1 guard above), so the link isn't offered.
  const header = renderHeader(true, restartHref);

  if (journeyComplete || !convo) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        {header}
        <h1 className="mt-8 font-serif text-4xl text-ink">Your journey, so far</h1>
        <p className="mt-4 text-lg text-ink">
          Your Journey is complete. What became visible has not been lost.
        </p>
        <p className="mt-3 text-lg text-muted">
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
            href={restartHref}
            className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Begin a new journey
          </Link>
          {/* The Library has no Youth-aware presentation yet (Living Library
              audit, Section Q) -- a self-identified minor never sees this
              continuation link, the same discipline already applied to
              profile.minor_with_guardian everywhere else on this page. No
              Youth-appropriate destination exists to substitute in its
              place, so it's simply omitted rather than replaced. */}
          {!profile?.minor_with_guardian && (
            <Link
              href="/library"
              className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
            >
              Continue exploring the Living Library
            </Link>
          )}
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
    return (
      <MembershipGate
        header={renderHeader(false)}
        checkout={searchParams?.checkout}
        isAnonymous={!!user.is_anonymous}
        justSaved={searchParams?.saved === "1"}
      />
    );
  }

  const rawMessages = await loadMessages(supabase, convo.id);

  // True only for the one page load immediately after a genuine, successful
  // Stripe redirect for this same Host -- checkout=success only ever arrives
  // via that redirect (see app/api/stripe/checkout/route.ts's success_url),
  // and we already know isMember is true here or the gate above would have
  // returned first. Not persisted anywhere -- once the Host clicks through
  // to /journey?enter=1 (or navigates anywhere else), this URL param is gone
  // and the acknowledgment doesn't reappear on any later visit.
  const justBecameMember = stage !== "iap" && searchParams?.checkout === "success";

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
        <DefyingGriefCrossing stage={stage} roomTitle={roomTitle} justBecameMember={justBecameMember} />
      </div>
    );
  }

  // The general-program counterpart to the block above -- same exact
  // first-message-not-yet-sent moment, for every case Defying Grief's
  // crossing doesn't cover (every program's first IAP message, and general
  // program's CAT/InnerCompass entries). See JourneyIntro's own comment.
  // IAP is included regardless of program -- DefyingGriefCrossing above
  // never covers IAP (it only has CAT/InnerCompass content), so without this
  // a Defying-Grief-tagged first IAP conversation would reach neither screen
  // and drop the Host straight into an empty chat with no orientation at all.
  if (
    rawMessages.length === 1 &&
    searchParams?.enter !== "1" &&
    (stage === "iap" || convo.program !== "defying-grief")
  ) {
    // Room Identity + a short description of what the Host is entering --
    // reused from the referral already generated at the previous stage,
    // not shown on IAP entry (nothing precedes it). Shared across every
    // program using this screen, general and Youth alike -- same data,
    // same presentation, no program branch needed here.
    const incoming =
      stage !== "iap" ? await getIncomingSummary(supabase, user.id, stage) : null;
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        {header}
        <JourneyIntro
          stage={stage}
          roomTitle={incoming?.roomIdentity ?? null}
          description={incoming?.description ?? null}
          justBecameMember={justBecameMember}
        />
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

/** The page header, with "Start a New Journey" (StartNewJourneyLink, with
 *  its own confirmation -- see that component) shown except on the
 *  membership gate -- see the ?new=1 guard above for why that link has
 *  nothing meaningful to do for a non-member sitting there. Renamed from
 *  "Start a new conversation" -- verified this actually archives whatever
 *  conversation is active and begins a brand-new Journey, not just another
 *  conversation inside the current one.
 *
 *  No Sign Out here -- it's already in the global Nav (components/Nav.tsx)
 *  on every page including this one, so it was showing twice. Removed only
 *  from this page-specific header; global Sign Out is untouched. */
function renderHeader(showRestart: boolean, restartHref: string = "/journey?new=1") {
  return (
    <div className="flex items-baseline justify-between">
      <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
        AVAIA
      </Link>
      {showRestart && <StartNewJourneyLink href={restartHref} />}
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
  isAnonymous,
  justSaved,
}: {
  header: React.ReactNode;
  checkout?: string;
  /** Where Stripe should send the Host back to after checkout — defaults to
   *  /journey if omitted. Defying Grief passes "/defying-grief" so a Host
   *  who pays from there lands back where they actually were, not on the
   *  general Journey page. */
  returnTo?: string;
  /** True for a Free-IAP visitor who hasn't attached an email yet --
   *  renders an extra "save your progress" section above the membership
   *  pitch. Deliberately its own heading, copy, and form: saving progress
   *  (free) and becoming a paying Member are two different moments and
   *  must never be collapsed into one combined ask. Skippable -- a Host
   *  who declines still sees the membership option below unchanged. */
  isAnonymous?: boolean;
  /** True immediately after returning from a successful email-confirmation
   *  link (app/auth/callback's ?saved=1). isAnonymous is already false by
   *  then, so the form above wouldn't render anyway -- this replaces that
   *  gap with an explicit acknowledgment instead of silence. */
  justSaved?: boolean;
}) {
  // Same gate, same price, same Stripe flow -- only the copy below
  // acknowledges where the Host actually is, using the returnTo value
  // /defying-grief already passes. No new data, no program-specific
  // entitlement logic.
  const isDefyingGrief = returnTo === "/defying-grief";
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      {header}
      {justSaved && (
        <p className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4 text-sm text-ink">
          Your progress has been saved.
        </p>
      )}
      {isAnonymous && (
        <div className="mt-8 rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm">
          <p className="font-serif text-lg text-ink">Save your progress</p>
          <p className="mt-1 text-sm text-muted">
            Your Individual Awareness Profile isn&rsquo;t attached to an email yet — add one so
            you can find your way back to it. This is free and separate from Membership.
          </p>
          <div className="mt-3">
            <SaveProgressForm />
          </div>
        </div>
      )}
      <h1 className="mt-8 font-serif text-4xl text-ink">Continue your journey</h1>
      <p className="mt-4 text-lg text-muted">
        {isDefyingGrief
          ? "Your Individual Awareness Profile was the beginning of Defying Grief."
          : "Your Individual Awareness Profile is the beginning."}
      </p>
      <p className="mt-4 text-lg text-muted">
        {isDefyingGrief
          ? "Membership continues your Defying Grief Journey into Conversations Across Time and InnerCompass, with your Workbook carrying it forward."
          : "Become an AVAIA member to continue into Conversations Across Time and access your ongoing AVAIA membership."}
      </p>
      {checkout === "cancelled" && (
        <p className="mt-4 text-sm text-muted">Checkout was cancelled — no charge was made.</p>
      )}
      {checkout === "success" && (
        <p className="mt-4 text-sm text-muted">
          Your payment was received. We&rsquo;re confirming your membership now. This usually takes
          just a moment.
        </p>
      )}
      <div className="mt-8">
        <Link
          href={`/membership${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Continue with Membership
        </Link>
      </div>
    </div>
  );
}

