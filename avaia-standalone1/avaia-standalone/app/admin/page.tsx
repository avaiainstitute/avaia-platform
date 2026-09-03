import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — AVAIA" };
export const dynamic = "force-dynamic";

type AdminSection = { href: string; label: string; description: string };

// The admin surface AVAIA actually has today -- three separate pages that
// existed before this one, none linked from anywhere in the app (found
// during the admin/Guide usability pass: reaching any of them required
// already knowing its exact URL). This page adds nothing new; it's the
// index those three pages were missing, plus the one Nav.tsx link that
// makes this page itself reachable.
const ADMIN_SECTIONS: AdminSection[] = [
  {
    href: "/admin/guide-candidates",
    label: "Guide Candidates",
    description: "Review and admit Guide candidates.",
  },
  {
    href: "/admin/library",
    label: "Library Content",
    description: "Manage AVAIA Living Library entries.",
  },
  {
    href: "/admin/reassign-participant",
    label: "Reassign Participant",
    description: "Move a Guide-facilitated participant to a different toolkit-authorized Guide, preserving their full record.",
  },
  {
    href: "/admin/youth-data",
    label: "Youth Data Retention / Deletion",
    description: "Find a Youth-linked record and see or delete every record linked to it.",
  },
];

export default async function AdminIndexPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/toolkit");

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Admin</p>
      <h1 className="font-serif text-4xl text-ink">Admin</h1>

      <div className="mt-10 space-y-3">
        {ADMIN_SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            prefetch={false}
            className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 transition-colors hover:border-seal"
          >
            <p className="font-serif text-lg text-ink">{s.label}</p>
            <p className="mt-1 text-sm text-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
