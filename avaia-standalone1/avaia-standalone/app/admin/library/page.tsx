import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminEntryStatusControls from "@/components/AdminEntryStatusControls";
import AdminSuggestionRow from "@/components/AdminSuggestionRow";
import type { LibraryEntry, LibrarySuggestion } from "@/lib/library";

export const metadata = { title: "Library Admin — AVAIA" };
export const dynamic = "force-dynamic";

export default async function AdminLibraryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await isAdmin(supabase, user.id))) redirect("/library");

  const { data: entriesData } = await supabase
    .from("library_entries")
    .select("id, title, great_idea, status, visibility, content_type, updated_at")
    .order("updated_at", { ascending: false });
  const entries = (entriesData as LibraryEntry[]) ?? [];

  const { data: suggestionsData } = await supabase
    .from("library_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const suggestions = (suggestionsData as LibrarySuggestion[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="flex items-baseline justify-between">
        <p className="label">Library Admin</p>
        <Link
          href="/admin/library/new"
          className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          New entry
        </Link>
      </div>
      <h1 className="mt-2 font-serif text-4xl text-ink">Library Admin</h1>

      {suggestions.length > 0 && (
        <section className="mt-12">
          <p className="label text-seal">
            Review queue ({suggestions.length} pending)
          </p>
          <div className="mt-4 space-y-4">
            {suggestions.map((s) => (
              <AdminSuggestionRow key={s.id} suggestion={s} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-12">
        <p className="label text-muted">All entries ({entries.length})</p>
        <div className="mt-4 space-y-3">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-white/[0.04] p-4"
            >
              <div>
                <Link href={`/admin/library/${e.id}/edit`} className="font-serif text-lg text-ink hover:text-seal">
                  {e.title}
                </Link>
                <p className="text-xs text-muted">
                  {e.status} · {e.visibility} · {e.content_type}
                </p>
              </div>
              <AdminEntryStatusControls entryId={e.id} status={e.status} />
            </div>
          ))}
          {entries.length === 0 && <p className="text-muted">No entries yet.</p>}
        </div>
      </section>
    </div>
  );
}
