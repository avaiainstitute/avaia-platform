import InquiriesView from "@/lib/admin-views/InquiriesView";

export const metadata = { title: "Inquiries, AVAIA Admin" };
export const dynamic = "force-dynamic";

// AVAIA's inquiries only. Pink Shoelace's live in /pink-admin/inquiries.
export default function AdminInquiriesPage({ searchParams }: { searchParams: { error?: string; updated?: string } }) {
  return <InquiriesView scope="avaia" searchParams={searchParams} />;
}
