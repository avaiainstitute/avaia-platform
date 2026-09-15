import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJournalEntry } from "@/lib/journal";
import JournalVirtueSignatureForm from "@/components/JournalVirtueSignatureForm";

export const metadata = { title: "Journal Entry, AVAIA" };
export const dynamic = "force-dynamic";

export default async function JournalEntryPage({
  params,
  searchParams,
}: {
  params: { entryId: string };
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/workbook/journal/${params.entryId}`);

  // RLS (self-only) already guarantees this returns null for anyone else's
  // entry; getJournalEntry never distinguishes "doesn't exist" from
  // "isn't yours" -- both are a plain 404 here.
  const entry = await getJournalEntry(supabase, params.entryId);
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook/journal" className="label hover:text-seal">
          ← Back to Journal
        </Link>
      </p>

      {searchParams?.saved === "1" && (
        <p className="mb-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          Saved.
        </p>
      )}

      <p className="label mb-3 text-muted">
        {new Date(entry.created_at).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        {" · "}
        {entry.entry_method === "talk" ? "Talked" : "Written"}
      </p>
      {entry.context && <p className="label mb-3 text-seal">Prompt: {entry.context.label}</p>}

      <div className="rounded-lg border border-rule bg-white/[0.04] p-6">
        <p className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-ink">{entry.content}</p>
      </div>

      <div className="mt-8 flex flex-wrap items-start gap-3">
        <Link
          href={`/journey?origin=journal&key=${entry.id}`}
          className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:border-seal"
        >
          Bring to a Conversation
        </Link>
        <JournalVirtueSignatureForm entryId={entry.id} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Both are entirely your choice. Nothing here happens automatically, and this entry stays
        exactly as you wrote it either way.
      </p>
    </div>
  );
}
