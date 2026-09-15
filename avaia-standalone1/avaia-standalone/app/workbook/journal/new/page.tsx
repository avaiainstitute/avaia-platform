import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JournalComposer from "@/components/JournalComposer";
import { JOURNAL_PROMPTS } from "@/lib/journal";

export const metadata = { title: "New Journal Entry, AVAIA" };
export const dynamic = "force-dynamic";

export default async function NewJournalEntryPage({
  searchParams,
}: {
  searchParams: { mode?: string; prompt?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook/journal/new");

  const autoTalk = searchParams?.mode === "talk";
  // Only a genuine, already-offered prompt label is ever used -- never
  // trusted as free text from the query string, same discipline as
  // /contact's ?reason= and /journey's ?origin=/&key=.
  const promptLabel = JOURNAL_PROMPTS.some((p) => p.label === searchParams?.prompt) ? searchParams!.prompt! : null;

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook/journal" className="label hover:text-seal">
          ← Back to Journal
        </Link>
      </p>
      <p className="label mb-3">Journal</p>
      <h1 className="font-serif text-4xl text-ink">{autoTalk ? "Talk" : "Write"}</h1>
      <p className="mt-4 text-muted">
        {autoTalk
          ? "Say whatever's on your mind. Tap the mic again when you're done, then save."
          : "Whatever you want to capture, exactly as it comes to you."}
      </p>

      <JournalComposer autoTalk={autoTalk} promptLabel={promptLabel} />
    </div>
  );
}
