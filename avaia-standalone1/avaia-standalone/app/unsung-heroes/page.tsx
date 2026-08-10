import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import UnsungHeroesChat from "@/components/UnsungHeroesChat";
import {
  getActiveUnsungHeroesConversation,
  createUnsungHeroesConversation,
  loadUnsungHeroesMessages,
} from "@/lib/engine/unsung-heroes";
import { UNSUNG_HEROES_PATH_LABEL, type UnsungHeroesPath } from "@/lib/engine/prompts";

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
    .select("consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

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

/** Shown to visitors who aren't signed in. */
function UnsungHeroesIntro() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <p className="label mb-3">Unsung Heroes</p>
      <h1 className="font-serif text-4xl text-ink">You noticed something real</h1>
      <p className="mt-4 text-lg text-muted">
        A short, guided conversation to help you name a quiet act of virtue — one you witnessed,
        one you received, or one you&rsquo;re hoping to grow into.
      </p>
      <div className="mt-8">
        <Link
          href="/sign-in"
          className="rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Sign in to begin
        </Link>
      </div>
    </div>
  );
}
