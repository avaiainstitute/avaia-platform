import OpportunitiesView from "@/lib/admin-views/OpportunitiesView";

export const metadata = { title: "Opportunities, AVAIA Admin" };
export const dynamic = "force-dynamic";

export default function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: { error?: string; updated?: string; researched?: string; inserted?: string };
}) {
  return <OpportunitiesView searchParams={searchParams} />;
}
