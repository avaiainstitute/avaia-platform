import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listJournalEntries, JOURNAL_PROMPTS } from "@/lib/journal";

export const metadata = { title: "Journal, AVAIA" };
export const dynamic = "force-dynamic";

function preview(text: string, max = 140): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max).trim()}…` : oneLine;
}

export default async function JournalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/workbook/journal");

  const { data: profile } = await supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const entries = await listJournalEntries(supabase, user.id);

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/workbook" className="label hover:text-seal">
          ← Back to your Workbook
        </Link>
      </p>
      <p className="label mb-3">Your Workbook</p>
      <h1 className="font-serif text-4xl text-ink">Journal</h1>
      <p className="mt-4 text-lg text-muted">
        What you want to capture along the way. A private place for a thought, a moment, a
        realization, or a question, whenever it comes to you. No prompt required, no response
        from AVAIA, nothing here is ever rewritten or interpreted. Just yours, to add to whenever
        you like.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/workbook/journal/new"
          className="inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Write
        </Link>
        <Link
          href="/workbook/journal/new?mode=talk"
          className="inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Talk
        </Link>
      </div>

      <section className="mt-10 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
        <p className="label mb-1 text-muted">Something to ponder? (optional)</p>
        <p className="mb-4 text-sm text-muted">
          A few already-established AVAIA reflection categories, offered only as a starting
          point. Skip this entirely and just write or talk if nothing here fits.
        </p>
        <div className="flex flex-wrap gap-2">
          {JOURNAL_PROMPTS.map((p) => (
            <Link
              key={p.label}
              href={`/workbook/journal/new?prompt=${encodeURIComponent(p.label)}`}
              className="rounded-full border border-rule px-3 py-1.5 text-sm text-ink transition-colors hover:border-seal"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </section>

      {entries.length === 0 ? (
        <p className="mt-14 text-muted">Nothing captured yet. Whenever you&rsquo;re ready.</p>
      ) : (
        <section className="mt-14">
          <p className="label mb-4">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
          <div className="space-y-3">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/workbook/journal/${e.id}`}
                className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="label text-muted">
                    {new Date(e.created_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <span className="label shrink-0 text-muted">{e.entry_method === "talk" ? "Talked" : "Written"}</span>
                </div>
                {e.context && <p className="mt-1 text-xs text-seal">{e.context.label}</p>}
                <p className="mt-2 text-sm text-ink">{preview(e.content)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
