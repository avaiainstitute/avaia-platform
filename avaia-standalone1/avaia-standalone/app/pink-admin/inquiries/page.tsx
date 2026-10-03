import InquiriesView from "@/lib/admin-views/InquiriesView";

export const metadata = { title: "Inquiries, Pink Shoelace Foundation Admin" };
export const dynamic = "force-dynamic";

export default function PinkAdminInquiriesPage({ searchParams }: { searchParams: { error?: string; updated?: string } }) {
  return <InquiriesView scope="pink" searchParams={searchParams} />;
}
