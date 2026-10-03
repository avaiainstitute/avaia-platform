import NotesView from "@/lib/admin-views/NotesView";

export const metadata = { title: "Ideas, Decisions & Follow-ups, AVAIA Admin" };
export const dynamic = "force-dynamic";

// AVAIA's notes only. The Pink Shoelace Foundation's live in /pink-admin/notes.
export default function AdminNotesPage({
  searchParams,
}: {
  searchParams: { error?: string; added?: string; updated?: string; promoted?: string; kind?: string };
}) {
  return <NotesView scope="avaia" searchParams={searchParams} />;
}
