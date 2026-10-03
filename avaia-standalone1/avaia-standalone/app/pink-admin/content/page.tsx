import ContentView from "@/lib/admin-views/ContentView";

export const metadata = { title: "Communications & Content, Pink Shoelace Foundation Admin" };
export const dynamic = "force-dynamic";

export default function PinkAdminContentPage({ searchParams }: { searchParams: { error?: string; added?: string; updated?: string } }) {
  return <ContentView scope="pink" searchParams={searchParams} />;
}
