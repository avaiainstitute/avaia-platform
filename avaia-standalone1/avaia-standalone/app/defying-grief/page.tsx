import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { createConversation, createJourney } from "@/lib/engine/conversation";
import DefyingGriefCrossing from "@/components/DefyingGriefCrossing";
import { MembershipGate } from "@/app/journey/page";
import {
  loadDefyingGriefDashboard,
  DEFYING_GRIEF_PROGRAM_NAME,
  DEFYING_GRIEF_STAGE_LABEL,
} from "@/lib/defying-grief";
import { isMember as checkIsMember } from "@/lib/membership";

export const metadata = { title: `${DEFYING_GRIEF_PROGRAM_NAME} — AVAIA` };
export const dynamic = "force-dynamic";

// A dimmed tile of AVAIA's real Chemistry of Virtue family colors (see
// lib/virtues.ts), used only as atmosphere behind the Threshold screen. The
// one lit "Au" tile below is drawn separately, in the ember accent, to make
// literal what the real CAT instructions already say: Audacity is not one of
// these families, but it gets a seat at the table anyway.
const VIRTUE_FIELD_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 40 40'%3E%3Crect x='2' y='2' width='16' height='16' rx='1.5' fill='%233f6fd4'/%3E%3Crect x='22' y='2' width='16' height='16' rx='1.5' fill='%238f1d1d'/%3E%3Crect x='2' y='22' width='16' height='16' rx='1.5' fill='%231c7a4a'/%3E%3Crect x='22' y='22' width='16' height='16' rx='1.5' fill='%233a97b8'/%3E%3C/svg%3E\")",
  backgroundSize: "56px 56px",
  backgroundRepeat: "repeat" as const,
  maskImage: "radial-gradient(ellipse at 50% 20%, black 0%, transparent 70%)",
  WebkitMaskImage: "radial-gradient(ellipse at 50% 20%, black 0%, transparent 70%)",
};

/** The lit "Au" tile — Defying Grief's one reserved accent, never used
 *  elsewhere in AVAIA. See lib/defying-grief.ts's design note. */
function AudacityTile() {
  return (
    <div className="relative mx-auto mb-3 h-24 w-24">
      <div className="absolute inset-0 -z-10 opacity-40" style={VIRTUE_FIELD_STYLE} />
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded border border-[#c1502e] bg-gradient-to-br from-[#c1502e]/25 to-[#c1502e]/5 shadow-[0_0_18px_rgba(193,80,46,0.25)]">
        <span className="font-serif text-2xl text-[#e8845a]">Au</span>
        <span className="mt-0.5 font-sans text-[0.55rem] uppercase tracking-wide text-ink/70">
          Audacity
        </span>
      </div>
    </div>
  );
}

const CTA_CLASSES =
  "inline-block rounded-md bg-[#c1502e] px-5 py-2.5 font-sans text-sm font-semibold text-[#0c0503] transition-shadow hover:shadow-[0_0_24px_rgba(193,80,46,0.4)]";

/** Shared Threshold copy — used for both the signed-out intro and the
 *  signed-in "haven't started yet" state. The call to action differs: a
 *  signed-out Host has to sign in first (a plain link); a signed-in Host's
 *  click directly opens the workshop (a form action), no intermediate page. */
function ThresholdContent({
  cta,
}: {
  cta: { kind: "link"; href: string } | { kind: "action"; action: (formData: FormData) => Promise<void> };
}) {
  return (
    <>
      <AudacityTile />
      <p className="text-center font-sans text-[0.7rem] text-muted">
        Not one of AVAIA&rsquo;s virtues. A seat at the table anyway.
      </p>
      <p className="label mt-8 mb-2">Dorian&rsquo;s second guided program</p>
      <h1 className="font-serif text-4xl text-ink sm:text-5xl">{DEFYING_GRIEF_PROGRAM_NAME}</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink">
        Grief did not ask permission to enter your life. This does not ask permission either.
      </p>
      <p className="mt-4 text-lg text-muted">
        This is not a program that resolves grief, and it will not ask you to move on. It asks
        something more audacious: that you keep participating in your own life anyway — awake to
        what was lost, and still willing to want, to try, to laugh, to build something that
        matters.
      </p>
      <p className="mt-4 text-lg text-muted">
        That willingness has a name here. AVAIA calls it <span className="text-ink">Audacity</span>{" "}
        — not a virtue exactly, but the force that makes a person insist on their own aliveness in
        the face of loss.
      </p>
      <p className="mt-4 text-lg text-muted">
        This is for anyone still carrying a loss that hasn&rsquo;t resolved — whether it happened
        recently or long ago — who isn&rsquo;t looking to move past it, but to keep living
        alongside it.
      </p>
      <p className="mt-4 text-lg text-muted">You are not asked to feel ready. Only to begin.</p>
      <div className="mt-8">
        {cta.kind === "link" ? (
          <Link href={cta.href} className={CTA_CLASSES}>
            I&rsquo;m Still Here
          </Link>
        ) : (
          <form action={cta.action}>
            <button type="submit" className={CTA_CLASSES}>
              I&rsquo;m Still Here
            </button>
          </form>
        )}
      </div>
      {cta.kind === "action" && (
        <p className="mt-3 text-xs text-muted">
          This begins here, on the AVAIA website.
        </p>
      )}

      {/* Defying Grief orientation — placed before the existing IAP/CAT/
          InnerCompass "room by room" section. Explains the program itself
          before explaining the conversations that carry it. */}
      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-2 text-muted">What Defying Grief is</p>
        <p className="text-lg leading-relaxed text-ink">
          Defying Grief is AVAIA applied specifically to loss and disruption. Here, grief
          isn&rsquo;t only about death. It&rsquo;s what shows up whenever something real is
          disrupted: a relationship, an identity, a plan for your life, a sense of who you
          were. If it was real and it&rsquo;s gone or changed, grief is the honest word for
          what&rsquo;s left.
        </p>
        <p className="mt-4 text-muted">
          A loss is a single point of impact — but the ripples move outward from there. What it
          quietly takes alongside it — meaning, trust, a sense of control, connection, a piece of
          your own identity — are Secondary Losses, and they&rsquo;re often where the real weight
          lives, even when nobody names them out loud.
        </p>
        <p className="mt-4 text-muted">
          Defying Grief doesn&rsquo;t start by telling you what to do or how you should grieve.
          It starts the way every AVAIA conversation does — with understanding before action.
          Nothing here prescribes an outcome or a timeline.{" "}
          <span className="text-ink">We don&rsquo;t move on, we move with.</span>
        </p>
        <p className="mt-4 text-muted">
          The movement is the same one every AVAIA journey follows: Awareness, then
          Understanding, then Agency. You say what&rsquo;s true first. Then it&rsquo;s
          understood — the Secondary Losses named, and the virtues connected to them brought
          into view. Only then does it become something you can actually decide about.
        </p>
        <p className="mt-4 text-muted">
          What that actually looks like, conversation by conversation, is below.
        </p>
      </div>

      {/* Secondary Losses — its own callout, not just the passing mention
          above. Deliberately not styled in the ember accent -- that color
          is reserved for Audacity specifically (see the pull-quotes below),
          so Secondary Losses gets the page's neutral card treatment. */}
      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-2 text-muted">Secondary Losses</p>
        <div className="rounded-lg border border-rule bg-white/[0.04] px-5 py-5 backdrop-blur-sm">
          <p className="text-lg leading-relaxed text-ink">
            The loss you can name is rarely the only one. When something real is taken, the
            primary loss is usually seen right away — but what it quietly takes alongside it
            often stays hidden, and that is frequently where the real weight lives.
          </p>
          <p className="mt-3 text-muted">
            Naming those Secondary Losses is part of what makes real understanding possible,
            before anything else happens.
          </p>
          <Link
            href="/secondary-loss"
            className="mt-4 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Explore the Secondary Loss Engine →
          </Link>
        </div>
        <p className="mt-4 text-sm">
          <Link
            href="/books/the-view-from-above"
            className="text-muted hover:text-seal"
          >
            From Dorian&rsquo;s own story →
          </Link>
        </p>
      </div>

      {/* What journey will I take — AVAIA is the house; Defying Grief is the
          program/journey; IAP, CAT, and InnerCompass are the same three
          AVAIA conversations that carry a Host through it. Content below is
          drawn from the existing public stage-explanation pages
          (/journey/iap, /journey/cat, /journey/innercompass), reframed
          under Defying Grief's own stage names -- not new engine content. */}
      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-2 text-muted">AVAIA is the house. Defying Grief is the journey.</p>
        <p className="text-sm text-muted">
          The Individual Awareness Profile, Conversations Across Time, and InnerCompass are the
          same three AVAIA conversations that carry every Host through every journey — here,
          they carry you through this one. Around them, the experience also includes teaching,
          activities, and reflection you can move through at your own pace — the conversations
          are part of it, not all of it.
        </p>

        <div className="mt-8 space-y-8">
          <div>
            <p className="label text-muted">Awareness</p>
            <p className="mt-1 font-serif text-xl text-ink">{DEFYING_GRIEF_STAGE_LABEL.iap}</p>
            <p className="mt-1 text-sm text-seal">You get to say it.</p>
            <p className="mt-3 text-muted">
              IAP comes first because nothing else can start until this is said. It gives you
              room to say what you&rsquo;ve been carrying, in your own words, at your own pace
              — what happened, what&rsquo;s in tension, what&rsquo;s still strong in you,
              what&rsquo;s been lost. It works exactly the same here as anywhere else in AVAIA
              — this is where Defying Grief begins, before Audacity has a name yet.
            </p>
            <Link
              href="/journey/iap"
              className="mt-2 inline-block text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
            >
              Read more about the Individual Awareness Profile →
            </Link>
          </div>

          <div>
            <p className="label text-muted">Understanding</p>
            <p className="mt-1 font-serif text-xl text-ink">{DEFYING_GRIEF_STAGE_LABEL.cat}</p>
            <p className="mt-1 text-sm text-seal">You get to understand it.</p>
            <p className="mt-3 text-muted">
              CAT doesn&rsquo;t ask you to keep listing what&rsquo;s wrong — it already has
              what became visible in IAP. Its work is to sit with that and help you see it more
              clearly: how it formed, what it&rsquo;s connected to, what it may still be
              costing you.
            </p>
            <p className="mt-4 border-l-4 border-[#c1502e]/60 pl-4 font-serif text-lg italic text-ink">
              The Audacity of Grief — the force that makes a person insist on their own
              aliveness in the face of loss.
            </p>
            <Link
              href="/journey/cat"
              className="mt-2 inline-block text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
            >
              Read more about Conversations Across Time →
            </Link>
          </div>

          <div>
            <p className="label text-muted">Agency</p>
            <p className="mt-1 font-serif text-xl text-ink">{DEFYING_GRIEF_STAGE_LABEL.innercompass}</p>
            <p className="mt-1 text-sm text-seal">You get to decide what belongs to you from here.</p>
            <p className="mt-3 text-muted">
              The question changes here — no longer what happened, or what does it mean, but
              what does this understanding allow me to do now? InnerCompass helps you see
              what&rsquo;s actually influencing a pull toward a direction, and whether that
              direction really belongs to you.
            </p>
            <p className="mt-4 border-l-4 border-[#c1502e]/60 pl-4 font-serif text-lg italic text-ink">
              The Audacity of Happiness — the nerve it takes to hope again, to dream something
              for yourself again, to laugh without it meaning you&rsquo;ve forgotten.
            </p>
            <Link
              href="/journey/innercompass"
              className="mt-2 inline-block text-sm text-ink underline decoration-rule underline-offset-2 hover:text-seal"
            >
              Read more about InnerCompass →
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-muted">
          Along the way, your{" "}
          <Link href="/workbook" prefetch={false} className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
            Workbook
          </Link>{" "}
          keeps a record of what emerges, and the{" "}
          <Link href="/chemistry" className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
            Chemistry of Virtue
          </Link>{" "}
          can help you recognize what&rsquo;s still here — the qualities, relationships, and
          capacities that remain, even now.
        </p>
        <p className="mt-4 text-sm text-muted">
          You can move through this on your own, at your own pace. Human Guide support is also
          available through AVAIA&rsquo;s Guided Journey pathway, where a Certified Guide can
          accompany a Journey you&rsquo;ve already begun on your own.
          Defying Grief can also be facilitated by a Certified AVAIA Guide, or experienced
          together — through a live workshop or a school or organization program, with the
          shared curriculum delivered to the room and each person&rsquo;s own private conversation
          kept theirs alone.
        </p>
        <p className="mt-4 text-sm text-muted">
          A version of Defying Grief exists for young people, too — adapted by age and always
          beginning with a parent or guardian&rsquo;s permission, and the Youth Host&rsquo;s own
          agreement, before anything starts.{" "}
          <Link href="/youth" className="text-ink underline decoration-rule underline-offset-2 hover:text-seal">
            Learn about Youth Defying Grief
          </Link>
          .
        </p>
      </div>

      {/* The bridge between Audacity of Grief and Audacity of Happiness --
          connects two pull-quotes the page already makes separately (CAT's
          and InnerCompass's, above) into the one idea the source material
          actually holds: one audacious force, redirected by intent. Not a
          new theory of audacity -- restating what's already there,
          explicitly. */}
      <div className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-2 text-muted">One force, two directions</p>
        <p className="text-lg leading-relaxed text-ink">
          The Audacity of Grief and the Audacity of Happiness are not two different things
          competing for control. For all intents and purposes, they can be the same audacious
          force. Audacity itself is boldness — and boldness can move in more than one
          direction. It can become destructive, arrogant, or consuming. It can also become
          courageous, noble, hopeful, loving, grateful, wise, or virtuous.
        </p>
        <p className="mt-4 text-muted">
          Defying Grief never asks you to become less audacious. It explores what becomes
          possible when the intent and direction of that same audacity begin to change. That
          starts with understanding what is real, and with what AVAIA calls Integrity Without
          Outcome Control — you can want, hope for, and work toward something with your whole
          self without pretending you can force reality to comply. That is not giving up, and
          it is not passivity. It is choosing, on purpose, what your boldness now serves.
          Virtue is what gives that choice its direction.
        </p>
        <p className="mt-4 text-muted">
          None of that requires happiness to replace grief. The Audacity of Happiness is not
          the absence of grief — it doesn&rsquo;t ask you to stop loving, stop remembering, or
          pretend nothing changed. Grief and happiness are allowed to exist within the same
          life, at the same time, in whatever proportion is actually true for you. What that
          looks like is yours to discover here — not something this page can tell you in
          advance.
        </p>
      </div>
    </>
  );
}

/** Creates the waiting placeholder IAP conversation, tagged so whatever
 *  referral eventually comes home from the GPT lands somewhere Defying Grief
 *  recognizes (see the program-preserving fix in
 *  app/api/gpt-actions/iap-referral/route.ts). Shared by the "I'm Still
 *  Here" button action and the autostart path below, so both go through the
 *  exact same archive-then-create logic. */
async function startDefyingGriefWorkshop(supabase: ReturnType<typeof createClient>, userId: string) {
  // The referral-receiving endpoint assumes one active conversation per
  // Host, the same assumption getActiveConversation relies on everywhere
  // else -- but nothing here previously enforced that. A stray active
  // conversation left over from unrelated earlier testing (any program,
  // any stage) could get picked up instead of this new one, silently
  // attaching a real referral to the wrong conversation. /journey?new=1
  // already archives the previous active conversation before creating a
  // fresh one; this does the same thing here.
  await supabase
    .from("conversations")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("host_id", userId)
    .eq("status", "active");

  // Every workshop start (including "Begin Another Journey") is a new
  // Journey -- never reuses a prior one, matching /journey?new=1.
  const journeyId = await createJourney(supabase, userId, "defying-grief");
  await createConversation(supabase, userId, "iap", undefined, "defying-grief", journeyId);
}

/** The "I'm Still Here" button's action, used once a Host is signed in,
 *  consented, and ready to begin. IAP happens on the AVAIA website, same as
 *  the general Journey -- /journey picks up the freshly created active
 *  conversation (tagged program: "defying-grief" by startDefyingGriefWorkshop
 *  above) and renders it directly. */
async function beginDefyingGriefWorkshop() {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/defying-grief");

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  await startDefyingGriefWorkshop(supabase, user.id);
  redirect("/journey");
}

export default async function DefyingGriefPage({
  searchParams,
}: {
  searchParams?: { checkout?: string; autostart?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <DefyingGriefIntro />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  // Checked here, before the Threshold screen ever renders -- not just
  // inside beginDefyingGriefWorkshop's own check further down. Consent
  // living only in the action meant a Host's first "I'm Still Here" click
  // got spent discovering they hadn't consented yet and bouncing to
  // /welcome, landing them back on this same page needing to click the
  // exact same button a second time to actually do anything. Checking it
  // here instead means a not-yet-consented Host never sees that button
  // until they're actually ready to use it -- matching how /journey has
  // always handled this same check.
  if (!profile?.consent_at) redirect("/welcome");

  const dashboard = await loadDefyingGriefDashboard(supabase, user.id);

  // ConsentForm sends a first-time Host here with ?autostart=1 once consent
  // is recorded -- they already expressed readiness twice by this point
  // (the original "I'm Still Here" click before signing in, then "I agree
  // -- begin" on the disclaimer), so this skips making them click a third,
  // functionally identical button and goes straight into the workshop the
  // moment this page would otherwise have shown it to them.
  if (searchParams?.autostart === "1" && !dashboard.started) {
    await startDefyingGriefWorkshop(supabase, user.id);
    redirect("/journey");
  }

  const isMember = await checkIsMember(supabase, user.id);

  const header = (
    <div className="flex items-baseline justify-between">
      <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
        AVAIA
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/workbook"
          className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
        >
          Workbook
        </Link>
        <SignOutButton />
      </div>
    </div>
  );

  if (!dashboard.started) {
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        {header}
        <div className="mt-8 text-center sm:text-left">
          <ThresholdContent cta={{ kind: "action", action: beginDefyingGriefWorkshop }} />
        </div>
      </div>
    );
  }

  const allComplete = dashboard.stages.every((s) => s.status === "complete");

  // A referral just came home from the workshop and the next stage's
  // placeholder conversation is waiting — this is the crossing moment. Since
  // the actual conversation never happens on the website (it's entirely in
  // ChatGPT), there's no "have they started typing yet" signal to detect
  // here the way the general Journey can; showing this every time the
  // dashboard is visited while a stage is mid-workshop is correct, not just
  // a fallback -- it's also how a Host gets back to an in-progress GPT trip.
  if (dashboard.activeStage === "cat" || dashboard.activeStage === "innercompass") {
    // IAP is free; Conversations Across Time and InnerCompass are an AVAIA
    // Membership feature, same rule the general Journey already enforces at
    // this exact boundary. The crossing screen (and the workshop it opens
    // onto) is exactly the thing being gated -- a free Host sees the same
    // membership offer instead, never the room itself.
    if (!isMember) {
      return (
        <MembershipGate
          header={header}
          checkout={searchParams?.checkout}
          returnTo="/defying-grief"
        />
      );
    }
    return (
      <div className="mx-auto max-w-prose px-5 py-16">
        {header}
        <p className="label mt-8 mb-2">Dorian&rsquo;s guided program</p>
        <h1 className="font-serif text-4xl text-ink">{DEFYING_GRIEF_PROGRAM_NAME}</h1>
        <DefyingGriefCrossing stage={dashboard.activeStage} roomTitle={dashboard.roomIdentity} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      {header}

      <p className="label mt-8 mb-2">Dorian&rsquo;s guided program</p>
      <h1 className="font-serif text-4xl text-ink">{DEFYING_GRIEF_PROGRAM_NAME}</h1>

      {allComplete && (
        <p className="mt-4 text-lg text-muted">
          This is what emerged. It&rsquo;s yours to keep, revisit, or share — nothing about it
          needs to be resolved any further.
        </p>
      )}

      {dashboard.roomIdentity && (
        <div className="mt-6 rounded-lg border border-[#c1502e]/40 bg-[#c1502e]/[0.06] px-5 py-4">
          <p className="font-sans text-xs uppercase tracking-wide text-muted">
            Room Identity — what emerged from your own words
          </p>
          <p className="mt-1 font-serif text-lg text-ink">{dashboard.roomIdentity}</p>
        </div>
      )}

      <ol className="mt-8 space-y-3">
        {dashboard.stages.map((s) => (
          <li
            key={s.stage}
            className="flex items-center justify-between rounded-lg border border-rule px-5 py-4"
          >
            <div>
              <p className="font-serif text-lg text-ink">{s.label}</p>
              <p className="mt-1 font-sans text-xs uppercase tracking-wide text-muted">
                {s.statusCopy}
              </p>
            </div>
            {s.href && (
              <Link
                href={s.href}
                className="inline-block shrink-0 rounded-md border border-rule px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
              >
                {s.status === "complete" ? "View" : "Continue"}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {allComplete && (
        <div className="mt-8 border-t border-rule pt-6">
          <p className="font-serif text-lg text-ink">
            You crossed all three rooms. That, itself, was an act of audacity.
          </p>
          <form action={beginDefyingGriefWorkshop} className="mt-6">
            <button type="submit" className={CTA_CLASSES}>
              Begin Another Journey
            </button>
          </form>
          <p className="mt-3 text-xs text-muted">
            What you already have stays exactly as it is in your Workbook. This starts a new,
            separate one alongside it — nothing here gets overwritten.
          </p>
        </div>
      )}
    </div>
  );
}

/** Shown to visitors who aren't signed in — the invitation to begin. */
function DefyingGriefIntro() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20 text-center sm:text-left">
      <ThresholdContent cta={{ kind: "link", href: "/sign-in?from=/defying-grief" }} />
    </div>
  );
}
