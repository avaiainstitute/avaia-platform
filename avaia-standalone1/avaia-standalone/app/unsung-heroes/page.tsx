import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import UnsungHeroesChat from "@/components/UnsungHeroesChat";
import UnsungHeroesIntro from "@/components/UnsungHeroesIntro";
import {
  getActiveUnsungHeroesConversation,
  createUnsungHeroesConversation,
  loadUnsungHeroesMessages,
} from "@/lib/engine/unsung-heroes";
import { UNSUNG_HEROES_PATH_LABEL, type UnsungHeroesPath } from "@/lib/engine/prompts";
import { isMember as checkIsMember } from "@/lib/membership";

export const metadata = { title: "Unsung Heroes — AVAIA" };
export const dynamic = "force-dynamic";

const PATHS = Object.keys(UNSUNG_HEROES_PATH_LABEL) as UnsungHeroesPath[];

export default async function UnsungHeroesPage({
  searchParams,
}: {
  searchParams?: { path?: string; new?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <UnsungHeroesIntro />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("consent_at, minor_with_guardian")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  // Individual/self-directed Unsung Heroes is an AVAIA Membership benefit.
  // This page is only ever reached for a Host's own conversation
  // (getActiveUnsungHeroesConversation below is always scoped to this
  // user's own host_id) -- Guide-facilitated sessions run through the
  // separate /toolkit/unsung-heroes/[sessionId] route entirely, so no
  // guide_sessions fallback is needed at this page level, mirroring how
  // /journey's own membership gate works. The shared message/recognition
  // API routes are the real enforcement boundary for both entry points.
  const isMember = await checkIsMember(supabase, user.id);
  if (!isMember) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <div className="flex items-baseline justify-between">
          <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
            AVAIA
          </Link>
          <SignOutButton />
        </div>
        <p className="label mb-3 mt-8">Unsung Heroes</p>
        <h1 className="font-serif text-4xl text-ink">This is an AVAIA Membership benefit</h1>
        <p className="mt-4 text-lg text-muted">
          Unsung Heroes is part of AVAIA Membership. Join to recognize how virtue becomes visible
          through everyday actions in yourself and others.
        </p>
        <div className="mt-8">
          <Link
            href="/membership"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Continue to Membership
          </Link>
        </div>
      </div>
    );
  }

  // Unsung Heroes' own conversation prompt (UNSUNG_HEROES_SHARED_POSTURE,
  // lib/engine/prompts.ts) unconditionally tells the model "You are
  // speaking with an adult Host" -- it has no program/developmentalBand
  // parameter to change that (see unsungHeroesSystemPrompt's signature).
  // Rather than let a self-identified minor start a conversation the model
  // is actively told is with an adult, block it here until a genuine Youth
  // Unsung Heroes adaptation is deliberately built -- same posture as the
  // membership gate just above, not a redesign of Unsung Heroes itself.
  if (profile?.minor_with_guardian) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <div className="flex items-baseline justify-between">
          <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
            AVAIA
          </Link>
          <SignOutButton />
        </div>
        <p className="label mb-3 mt-8">Unsung Heroes</p>
        <h1 className="font-serif text-4xl text-ink">Not yet available for Youth</h1>
        <p className="mt-4 text-lg text-muted">
          Unsung Heroes hasn&rsquo;t been adapted for Youth Hosts yet. Your Youth Journey — IAP, CAT,
          and InnerCompass — is fully available; this one feature isn&rsquo;t part of it yet.
        </p>
        <div className="mt-8">
          <Link
            href="/journey"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Return to your Journey
          </Link>
        </div>
      </div>
    );
  }

  const header = (
    <div className="flex items-baseline justify-between">
      <Link href="/" className="font-serif text-xl tracking-[0.16em] text-ink">
        AVAIA
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/unsung-heroes/dashboard"
          className="font-sans text-xs uppercase tracking-wide text-muted transition-colors hover:text-seal"
        >
          Dashboard
        </Link>
        <SignOutButton />
      </div>
    </div>
  );

  // A chosen path (from the picker below) starts a fresh conversation and
  // redirects to a clean URL, matching /journey?new=1's pattern.
  const chosenPath = searchParams?.path as UnsungHeroesPath | undefined;
  if (chosenPath && PATHS.includes(chosenPath)) {
    await createUnsungHeroesConversation(supabase, user.id, chosenPath);
    redirect("/unsung-heroes");
  }

  const convo = await getActiveUnsungHeroesConversation(supabase, user.id);

  if (!convo) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        {header}
        <p className="label mb-3 mt-8">Unsung Heroes</p>
        <h1 className="font-serif text-4xl text-ink">You noticed something real</h1>
        <p className="mt-4 text-lg text-muted">
          Quiet acts of virtue happen constantly and mostly go unacknowledged. This is a short,
          guided conversation to help you name what you saw, and say so.
        </p>

        <div className="mt-8 grid gap-3">
          {PATHS.map((p) => (
            <Link
              key={p}
              href={`/unsung-heroes?path=${p}`}
              className={
                "rounded-lg border px-5 py-4 font-sans text-sm font-medium transition-colors " +
                (p === "i_saw_someone"
                  ? "border-seal bg-seal/[0.06] text-ink hover:bg-seal/[0.1]"
                  : "border-rule text-ink hover:border-seal")
              }
            >
              {UNSUNG_HEROES_PATH_LABEL[p]}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const rawMessages = await loadUnsungHeroesMessages(supabase, convo.id);
  const messages = rawMessages.map((m) => ({ role: m.role, content: m.content }));

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      {header}
      <p className="label mb-3 mt-8">Unsung Heroes</p>
      <h1 className="font-serif text-3xl text-ink">{UNSUNG_HEROES_PATH_LABEL[convo.path]}</h1>
      <UnsungHeroesChat
        key={convo.id}
        conversationId={convo.id}
        pathLabel={UNSUNG_HEROES_PATH_LABEL[convo.path]}
        initialMessages={messages}
      />
    </div>
  );
}
