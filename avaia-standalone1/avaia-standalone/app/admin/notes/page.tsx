import NotesView from "@/lib/admin-views/NotesView";

export const metadata = { title: "Ideas, Decisions & Follow-ups, AVAIA Admin" };
export const dynamic = "force-dynamic";

export default function AdminNotesPage({
  searchParams,
}: {
  searchParams: { error?: string; added?: string; updated?: string; promoted?: string; kind?: string };
}) {
  return <NotesView searchParams={searchParams} />;
}
