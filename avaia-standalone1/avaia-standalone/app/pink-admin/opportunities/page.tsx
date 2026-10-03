import OpportunitiesView from "@/lib/admin-views/OpportunitiesView";

export const metadata = { title: "Opportunities, Pink Shoelace Foundation Admin" };
export const dynamic = "force-dynamic";

export default function PinkAdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string; researched?: string; inserted?: string };
}) {
  return <OpportunitiesView scope="pink" searchParams={searchParams} />;
}
