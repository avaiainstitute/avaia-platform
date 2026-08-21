import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LibraryEntry } from "@/lib/library";

export const metadata = { title: "My Library — AVAIA" };
export const dynamic = "force-dynamic";

/** What the Host explicitly chose to keep -- saved entries and entries
 *  they left a note on. Not a log of everything they've ever opened
 *  (explored-only rows are deliberately excluded), and not entries marked
 *  "not for me" (an explicit dismissal, the opposite of a keep). A
 *  continuity layer over library_entries, not a second copy of it. */
export default async function MyLibraryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/library/mine");

  const { data: hostRows } = await supabase
    .from("library_host_entries")
    .select("library_entry_id, state, note, explored_at, updated_at")
    .eq("host_id", user.id)
    .or("state.eq.save,note.not.is.null")
    .order("updated_at", { ascending: false });

  type HostRow = { library_entry_id: string; state: string | null; note: string | null; updated_at: string };
  const rows = (hostRows as HostRow[]) ?? [];

  const entryIds = rows.map((r) => r.library_entry_id);
  const { data: entriesData } =
    entryIds.length > 0
      ? await supabase.from("library_entries").select("*").in("id", entryIds)
      : { data: [] as LibraryEntry[] };
  const entryById = new Map(((entriesData as LibraryEntry[]) ?? []).map((e) => [e.id, e]));

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="mb-6">
        <Link href="/library" className="label hover:text-seal">
          ← Back to the Library
        </Link>
      </p>
      <p className="label mb-3">Library</p>
      <h1 className="font-serif text-4xl text-ink">My Library</h1>
      <p className="mt-4 text-lg text-muted">
        What you&rsquo;ve chosen to keep — not everything you&rsquo;ve looked at.
      </p>

      {rows.length === 0 ? (
        <p className="mt-12 text-muted">Nothing saved yet.</p>
      ) : (
        <div className="mt-10 space-y-3">
          {rows.map((row) => {
            const entry = entryById.get(row.library_entry_id);
            if (!entry) {
              // Retired/archived since the Host saved it -- handled
              // honestly rather than silently dropped or crashing.
              return (
                <div
                  key={row.library_entry_id}
                  className="rounded-lg border border-rule bg-white/[0.04] px-5 py-4 opacity-60"
                >
                  <p className="text-ink">This entry is no longer available.</p>
                  {row.note && <p className="mt-2 text-sm text-muted">Your note: {row.note}</p>}
                </div>
              );
            }
            return (
              <Link
                key={entry.id}
                href={`/library/${entry.id}`}
                className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{entry.title}</p>
                  <span className="label text-muted">{row.state === "save" ? "Saved" : "Noted"}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{entry.overview}</p>
                {row.note && (
                  <p className="mt-2 text-sm italic text-ink">&ldquo;{row.note}&rdquo;</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
