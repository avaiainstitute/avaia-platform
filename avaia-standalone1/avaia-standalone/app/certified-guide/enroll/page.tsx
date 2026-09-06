import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GuideEnrollForm from "@/components/GuideEnrollForm";

export const metadata = { title: "Enroll — Certified AVAIA Guide" };
export const dynamic = "force-dynamic";

export default async function CertifiedGuideEnrollPage({
  searchParams,
}: {
  searchParams?: { checkout?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <p className="label mb-3">Certified AVAIA Guide</p>
        <h1 className="font-serif text-3xl text-ink">Sign in to enroll</h1>
        <p className="mt-4 text-lg text-muted">
          Create or sign in to your AVAIA account first, then come back here to enroll.
        </p>
        <Link
          href="/sign-in?from=/certified-guide/enroll"
          className="mt-8 inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const { data: existingPayment } = await supabase
    .from("guide_certification_payments")
    .select("id, paid_at")
    .eq("host_id", user.id)
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <Link href="/certified-guide" className="label text-muted hover:text-seal">
        &larr; Certified AVAIA Guide
      </Link>
      <p className="label mb-3 mt-6">Certified AVAIA Guide</p>
      <h1 className="font-serif text-4xl text-ink">Enroll in the Program</h1>

      {searchParams?.checkout === "cancelled" && (
        <p className="mt-6 rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-sm text-muted">
          Checkout was cancelled. Nothing was charged.
        </p>
      )}

      {(searchParams?.checkout === "success" || existingPayment) ? (
        <div className="mt-8 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-6">
          <p className="font-serif text-xl text-ink">Payment received.</p>
          <p className="mt-3 text-ink">
            {existingPayment
              ? `Recorded ${new Date(existingPayment.paid_at).toLocaleDateString()}.`
              : "Thank you — this is now on file."}{" "}
            AVAIA will follow up directly about Orientation and next steps. Enrollment records your
            payment; it does not itself admit you as a certification candidate or grant any Guide
            permission — that follows as a separate step.
          </p>
          <Link
            href="/contact?reason=certification"
            className="mt-6 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
          >
            Questions? Contact AVAIA
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-4 text-lg leading-relaxed text-ink">
            The current program investment is <strong>$4,500</strong>, paid in full. Payment is the
            Enroll step of the certification pathway — Orientation, training, practicum, and the
            certification decision itself all follow separately.
          </p>
          <p className="mt-4 text-muted">
            Looking for an installment arrangement instead?{" "}
            <Link href="/contact?reason=certification" className="underline decoration-rule underline-offset-2 hover:text-seal">
              Reach out to ask about current options
            </Link>{" "}
            rather than paying in full here.
          </p>
          <GuideEnrollForm />
        </>
      )}
    </div>
  );
}
