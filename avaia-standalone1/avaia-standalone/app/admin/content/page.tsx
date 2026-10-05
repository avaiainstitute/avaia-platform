import ContentView from "@/lib/admin-views/ContentView";

export const metadata = { title: "Communications & Content, AVAIA Admin" };
export const dynamic = "force-dynamic";

export default function AdminContentPage({ searchParams }: { searchParams: { error?: string; added?: string; updated?: string } }) {
  return <ContentView searchParams={searchParams} />;
}
