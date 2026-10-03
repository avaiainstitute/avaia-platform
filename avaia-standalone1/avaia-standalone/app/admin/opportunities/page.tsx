import OpportunitiesView from "@/lib/admin-views/OpportunitiesView";

export const metadata = { title: "Opportunities, AVAIA Admin" };
export const dynamic = "force-dynamic";

// AVAIA's opportunities only. The Pink Shoelace Foundation's live in /pink-admin/opportunities.
export default function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string; researched?: string; inserted?: string };
}) {
  return <OpportunitiesView scope="avaia" searchParams={searchParams} />;
}
