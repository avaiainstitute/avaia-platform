import InquiriesView from "@/lib/admin-views/InquiriesView";

export const metadata = { title: "Inquiries, AVAIA Admin" };
export const dynamic = "force-dynamic";

export default function AdminInquiriesPage({ searchParams }: { searchParams: { error?: string; updated?: string } }) {
  return <InquiriesView searchParams={searchParams} />;
}
