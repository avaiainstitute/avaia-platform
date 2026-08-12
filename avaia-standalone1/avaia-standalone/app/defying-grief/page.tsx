import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import { createConversation } from "@/lib/engine/conversation";
import DefyingGriefCrossing from "@/components/DefyingGriefCrossing";
import { MembershipGate } from "@/app/journey/page";
import {
  loadDefyingGriefDashboard,
  DEFYING_GRIEF_PROGRAM_NAME,
  IAP_GPT_URL,
} from "@/lib/defying-grief";

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
          This opens the Individual Awareness Profile in ChatGPT — a new tab, not this site.
        </p>
      )}
      <p className="mt-4 text-xs text-muted">
        Individual Awareness Profile → Conversations Across Time: The Audacity of Grief →
        InnerCompass: The Audacity of Happiness
      </p>
    </>
  );
}

/** Begins Defying Grief's workshop trip: creates the waiting placeholder IAP
 *  conversation, tagged so whatever referral eventually comes home from the
 *  GPT lands somewhere Defying Grief recognizes (see the program-preserving
 *  fix in app/api/gpt-actions/iap-referral/route.ts), then sends the Host
 *  straight to the real GPT. AVAIA doesn't render anything from here until
 *  the referral comes home. */
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
    .eq("host_id", user.id)
    .eq("status", "active");

  await createConversation(supabase, user.id, "iap", undefined, "defying-grief");

  redirect(IAP_GPT_URL);
}

export default async function DefyingGriefPage({
  searchParams,
}: {
  searchParams?: { checkout?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <DefyingGriefIntro />;

  const dashboard = await loadDefyingGriefDashboard(supabase, user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_status")
    .eq("id", user.id)
    .maybeSingle();
  const isMember = profile?.membership_status === "member";

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
