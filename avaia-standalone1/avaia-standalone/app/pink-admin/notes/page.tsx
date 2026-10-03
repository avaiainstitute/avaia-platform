import NotesView from "@/lib/admin-views/NotesView";

export const metadata = { title: "Ideas, Decisions & Follow-ups, Pink Shoelace Foundation Admin" };
export const dynamic = "force-dynamic";

export default function PinkAdminNotesPage({
  searchParams,
}: {
  searchParams: { error?: string; added?: string; updated?: string; promoted?: string; kind?: string };
}) {
  return <NotesView scope="pink" searchParams={searchParams} />;
}
