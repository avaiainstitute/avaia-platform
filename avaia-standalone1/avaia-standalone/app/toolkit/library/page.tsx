import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LibraryEntry } from "@/lib/library";

export const metadata = { title: "Library — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Read-only Library browse for Guides -- the data layer and RLS ("library
 *  entries guide read", added in 0012_guide_toolkit_expansion.sql) are
 *  ported from the unmerged `library` branch; the admin CRUD/suggestion-
 *  review UI is not ported in this pass, so this will show "nothing
 *  published yet" until entries exist to publish -- an honest empty state,
 *  not a broken one. */
export default async function ToolkitLibraryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const { data } = await supabase
    .from("library_entries")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  const entries = (data as LibraryEntry[]) ?? [];

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">AVAIA Library</h1>
      <p className="mt-4 text-lg text-muted">
        Browsable AVAIA resources — the data layer and Guide access are installed; the full
        content-management tooling (adding and editing entries) is a separate, later step.
      </p>

      {entries.length === 0 ? (
        <p className="mt-10 text-muted">Nothing published yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4">
              <p className="font-serif text-lg text-ink">{entry.title}</p>
              <p className="mt-1 text-sm text-muted">{entry.overview}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
