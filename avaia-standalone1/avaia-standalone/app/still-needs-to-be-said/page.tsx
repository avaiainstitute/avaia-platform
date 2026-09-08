import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import UnsaidChat from "@/components/UnsaidChat";
import UnsaidIntake from "@/components/UnsaidIntake";
import {
  getActiveUnsaidConversation,
  loadUnsaidMessages,
  startUnsaidConversation,
  endUnsaidConversation,
  deleteUnsaidConversation,
} from "@/lib/engine/unsaid";

export const metadata = { title: "What Still Needs to Be Said — AVAIA" };
export const dynamic = "force-dynamic";

export default async function StillNeedsToBeSaidPage({
  searchParams,
}: {
  searchParams?: { new?: string; error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">What Still Needs to Be Said</p>
        <h1 className="font-serif text-4xl text-ink">Some conversations can&rsquo;t happen in ordinary life</h1>
        <p className="mt-4 text-lg text-muted">
          A private space to say what still needs to be said — to someone who has died, someone
          estranged, someone far away, or anyone else you can&rsquo;t have this conversation with
          right now. Say it and let it be received, or ask for something back.
        </p>
        <div className="rule-t mt-14 border-t border-rule pt-8">
          <p className="label mb-2 text-muted">You choose how it goes</p>
          <p className="text-ink">
            Some things just need somewhere to go. Other times you may want to hear something
            back — not necessarily what you want to hear, but something true. Both are available
            here, and you decide which, every time you speak.
          </p>
        </div>
        <div className="mt-8">
          <Link
            href="/sign-in?from=/still-needs-to-be-said"
            className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Sign In to Begin
          </Link>
        </div>
      </div>
    );
  }

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
      <SignOutButton />
    </div>
  );

  const convo = !searchParams?.new ? await getActiveUnsaidConversation(supabase, user.id) : null;

  if (!convo) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        {header}
        <p className="label mb-3 mt-8">What Still Needs to Be Said</p>
        <h1 className="font-serif text-4xl text-ink">Who do you need to talk to?</h1>
        <p className="mt-3 text-muted">A name, a relationship, however you think of them.</p>

        {searchParams?.error && (
          <p className="mt-4 text-sm text-[#e0857d]">{searchParams.error}</p>
        )}

        <UnsaidIntake action={startUnsaidConversation} />
      </div>
    );
  }

  const rawMessages = await loadUnsaidMessages(supabase, convo.id);
  const messages = rawMessages.map((m) => ({
    role: m.role,
    content: m.content,
    heard: m.role === "host" && m.wants_response === false,
  }));

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      {header}
      <p className="label mb-3 mt-8">What Still Needs to Be Said</p>
      <h1 className="font-serif text-3xl text-ink">{convo.recipient}</h1>
      <UnsaidChat
        key={convo.id}
        conversationId={convo.id}
        recipient={convo.recipient}
        hasGrounding={Boolean(convo.grounding)}
        initialMessages={messages}
        endAction={endUnsaidConversation}
        deleteAction={deleteUnsaidConversation}
      />
    </div>
  );
}
