import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCandidateAccess } from "@/lib/certification";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Certification, AVAIA" };
export const dynamic = "force-dynamic";

/** Gates the whole /certification tree. Not membership_status and not a
 *  normal AVAIA account: only a person a human admin has admitted as an open
 *  Guide certification candidate sees the classroom. Everyone else, including
 *  signed-in members and Guides, sees a plain notice and none of the course.
 *  Each page and server action also re-checks this itself (a layout does not
 *  stop a page from running), see lib/certification-access.ts. */
export default async function CertificationLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/certification");

  const { data: profile } = await supabase.from("profiles").select("consent_at").eq("id", user.id).maybeSingle();
  if (!profile?.consent_at) redirect("/welcome");

  const access = await getCandidateAccess(supabase, user.id);

  if (access.kind !== "active") {
    return (
      <div className="mx-auto max-w-prose px-5 py-24">
        <p className="label mb-3">Certification</p>
        <h1 className="font-serif text-4xl text-ink">
          {access.kind === "restricted" ? "Your certification is on pause" : "Not currently available"}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          {access.kind === "restricted"
            ? "Your candidacy is currently paused or on hold, so the classroom is closed for now. Everything you have already done is saved. Please reach out to AVAIA directly to talk about next steps."
            : "The certification classroom is for people AVAIA has admitted as Guide certification candidates. If you believe you should have access, please reach out to AVAIA directly."}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/contact?reason=certification"
            className="rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Contact AVAIA
          </Link>
          <Link href="/" className="px-2 py-2.5 font-sans text-sm text-muted hover:text-seal">
            Back to AVAIA
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
      <div className="flex items-baseline justify-between gap-4">
        <Link href="/certification" className="flex items-baseline gap-2.5">
          <span className="font-serif text-xl tracking-[0.16em] text-ink">AVAIA</span>
          <span className="label text-muted">Guide Certification</span>
        </Link>
        <SignOutButton />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
