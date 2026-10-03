import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Certified AVAIA Guide" };
export const dynamic = "force-dynamic";

// The original pay-to-enroll path ($4,500 checkout that opened candidacy on
// payment) is CLOSED. This route is kept only so old links land somewhere
// sensible; it no longer offers checkout and creates nothing. A Host who
// paid under the old path still sees that their payment is on record
// (guide_certification_payments is preserved as history).

export default async function CertifiedGuideEnrollPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const existingPayment = user
    ? (
        await supabase
          .from("guide_certification_payments")
          .select("id, paid_at")
          .eq("host_id", user.id)
          .order("paid_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data
    : null;

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <Link href="/certified-guide" className="label text-muted hover:text-seal">
        &larr; Certified AVAIA Guide
      </Link>
      <p className="label mb-3 mt-6">Certified AVAIA Guide</p>
      <h1 className="font-serif text-4xl text-ink">Enrollment is not open on this page</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        The Guide pathway no longer begins with an online payment. Admission is by AVAIA&rsquo;s review,
        and nothing here charges you or enrolls you.
      </p>

      {existingPayment && (
        <div className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-6">
          <p className="font-serif text-xl text-ink">Your earlier payment is on record.</p>
          <p className="mt-3 text-ink">
            Recorded {new Date(existingPayment.paid_at).toLocaleDateString()}. AVAIA will follow up with
            you directly about it.
          </p>
        </div>
      )}

      <Link
        href="/contact?reason=certification"
        className="mt-8 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
      >
        Contact AVAIA About the Guide Pathway
      </Link>
    </div>
  );
}
