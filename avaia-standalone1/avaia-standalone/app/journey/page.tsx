import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import JourneyChat from "@/components/JourneyChat";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  getActiveConversation,
  createConversation,
  loadMessages,
} from "@/lib/engine/conversation";
import { OPERATING_PRINCIPLES } from "@/lib/institution";
import type { Stage } from "@/lib/engine/prompts";

export const metadata = { title: "Your Journey — AVAIA" };
export const dynamic = "force-dynamic";

export default async function JourneyPage({
  searchParams,
}: {
  searchParams?: { new?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <JourneyIntro />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  // Resolve the conversation to show: the active one, or open IAP on first entry.
  let convo = await getActiveConversation(supabase, user.id);

  // "Begin again" — start a brand-new journey with a fresh IAP conversation,
  // no matter what stage (or which leftover active conversation) the Host was
  // last in. If something's still marked active, archive it as complete first
  // so it stops being picked up as "the" active conversation, then create a
  // clean IAP conversation. Redirect to a clean URL so a refresh doesn't spawn
  // another empty conversation.
  if (searchParams?.new === "1") {
    if (convo) {
      await supabase
        .from("conversations")
        .update({ status: "complete", completed_at: new Date().toISOString() })
        .eq("id", convo.id);
    }
    await createConversation(supabase, user.id, "iap");
    redirect("/journey");
  }

  let journeyComplete = false;
  if (!convo) {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("host_id", user.id);
    if ((count ?? 0) === 0) {
      convo = await createConversation(supabase, user.id, "iap");
    } else {
      journeyComplete = true;
    }
  }

  const header = (
    <div className="flex items-baseline justify-between">
      <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
        AVAIA
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/journey?new=1"
          className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
        >
          Start a new conversation
        </Link>
        <SignOutButton />
      </div>
    </div>
  );

  if (journeyComplete || !convo) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        {header}
        <h1 className="mt-8 font-serif text-4xl text-ink">Your journey, so far</h1>
        <p className="mt-4 text-lg text-muted">
          You&rsquo;ve walked through Awareness, Understanding, and Discernment. Everything is saved
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
  const rawMessages = await loadMessages(supabase, convo.id);
  const messages = rawMessages.map((m) => ({ role: m.role, content: m.content }));
  const currentIdx = STAGE_ORDER.indexOf(stage);

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
        isLast={stage === "innercompass"}
        initialMessages={messages}
      />
    </div>
  );
}

/** Shown to visitors who aren't signed in — the invitation to begin, then the
 *  principles every part of AVAIA holds to. The Core Conversation Flow lives in
 *  the Constitution; here we only invite the Host in. */
function JourneyIntro() {
  return (
    <div className="mx-auto max-w-5xl px-5">
      {/* Hero */}
      <section className="py-16 sm:py-24">
        <p className="label mb-4">An operating system for guided conversations</p>
        <h1 className="font-serif text-5xl leading-tight tracking-[0.12em] text-ink sm:text-7xl">
          AVAIA
        </h1>
        <p className="mt-3 font-cinzel text-sm uppercase tracking-[0.28em] text-phoenix sm:text-base">
          Clarity Starts With Integrity
        </p>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink">
          One conversation, carried across time. AVAIA is a fixed way of holding
          a conversation so that a person is seen, understanding comes before
          action, and the Host owns every decision.
        </p>
        <div className="mt-8">
          <Link
            href="/sign-in"
            className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Begin the journey
          </Link>
        </div>
      </section>

      {/* Principles */}
      <section className="py-12">
        <p className="label mb-6">What every part of AVAIA holds to</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPERATING_PRINCIPLES.slice(0, 6).map((p) => (
            <div key={p.title} className="rounded-lg border border-rule bg-white/[0.04] backdrop-blur-sm px-5 py-4">
              <p className="font-serif text-ink">{p.title}</p>
              <p className="mt-1 text-sm text-muted">{p.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link href="/#principles" className="label hover:text-seal">
            The Constitution &amp; all 18 principles →
          </Link>
        </div>
      </section>
    </div>
  );
}
