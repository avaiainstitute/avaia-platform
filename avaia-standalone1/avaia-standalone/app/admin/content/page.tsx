import ContentView from "@/lib/admin-views/ContentView";

export const metadata = { title: "Communications & Content, AVAIA Admin" };
export const dynamic = "force-dynamic";

// AVAIA's content plans only. The Pink Shoelace Foundation's live in /pink-admin/content.
export default function AdminContentPage({ searchParams }: { searchParams: { error?: string; added?: string; updated?: string } }) {
  return <ContentView scope="avaia" searchParams={searchParams} />;
}
