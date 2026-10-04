import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  ADMISSION_AMOUNT_LABEL,
  PATHWAY_LABEL,
  PATHWAYS,
  validateApplication,
  type ApplicationStatus,
} from "@/lib/certification-admissions";
import { startPaymentMethodSetup } from "@/lib/ops/certification-admissions";

export const metadata = { title: "Apply, Certified AVAIA Guide" };
export const dynamic = "force-dynamic";

// THE FRONT DOOR OF GUIDE CERTIFICATION (Decision 0004).
//
// Apply (no fee) -> save a payment method (nothing is charged) -> a person at
// AVAIA reviews -> a person decides admission -> only if admitted, the standard
// certification payment is charged once. Admission makes you a Candidate. It is
// not certification: certification is a separate decision made later, from what
// you demonstrate. This page never says otherwise.

const ERROR_TEXT: Record<string, string> = {
  name: "Please tell us your name.",
  contact: "Please tell us how to reach you (email or phone).",
  why: "Please tell us why you are interested.",
  work: "Please describe the work or community you do.",
  how: "Please tell us how you imagine using AVAIA.",
  pathway: "Please choose whether this is core Guide certification or another permission.",
  orientation: "Please agree to receive orientation so we can reach you about next steps.",
  long: "One of your answers is too long. Please shorten it.",
  save: "We could not save your application. Please try again.",
  setup: "We could not open the secure card page. Please try again.",
  exists: "You already have an application in progress.",
};

function originFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.avaiainstitute.com";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function submitApplication(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/certified-guide/apply");

  const checked = validateApplication({
    fullName: String(formData.get("fullName") ?? ""),
    contact: String(formData.get("contact") ?? ""),
    whyInterested: String(formData.get("whyInterested") ?? ""),
    workContext: String(formData.get("workContext") ?? ""),
    howUseAvaia: String(formData.get("howUseAvaia") ?? ""),
    pathway: String(formData.get("pathway") ?? ""),
    pathwayNote: String(formData.get("pathwayNote") ?? ""),
    orientationAgreed: formData.get("orientationAgreed") === "on",
  });
  if (!checked.ok) redirect(`/certified-guide/apply?error=${checked.code}`);
  const v = checked.value;

  const { data: inserted, error } = await supabase
    .from("certification_applications")
    .insert({
      host_id: user.id,
      full_name: v.fullName,
      contact: v.contact,
      why_interested: v.whyInterested,
      work_context: v.workContext,
      how_use_avaia: v.howUseAvaia,
      pathway: v.pathway,
      pathway_note: v.pathwayNote,
      orientation_agreed: v.orientationAgreed,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    redirect(`/certified-guide/apply?error=${error?.code === "23505" ? "exists" : "save"}`);
  }

  const setup = await startPaymentMethodSetup({
    applicationId: (inserted as { id: string }).id,
    hostId: user.id,
    email: user.email ?? null,
    origin: originFromHeaders(),
  });
  if (!setup.ok) redirect("/certified-guide/apply?error=setup");
  redirect(setup.url);
}

async function continueToPaymentMethod(formData: FormData) {
  "use server";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/certified-guide/apply");
  const applicationId = String(formData.get("applicationId") ?? "");
  const setup = await startPaymentMethodSetup({ applicationId, hostId: user.id, email: user.email ?? null, origin: originFromHeaders() });
  if (!setup.ok) redirect("/certified-guide/apply?error=setup");
  redirect(setup.url);
}

const inputClass =
  "w-full rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal";

export default async function ApplyPage({ searchParams }: { searchParams: { error?: string; saved?: string; cancelled?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-prose px-5 py-20">
        <Link href="/certified-guide" className="label text-muted hover:text-seal">
          &larr; Certified AVAIA Guide
        </Link>
        <p className="label mb-3 mt-6">Apply</p>
        <h1 className="font-serif text-4xl text-ink">Apply to the Guide certification path</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink">Please sign in first so your application is connected to your AVAIA account.</p>
        <Link
          href="/sign-in?from=/certified-guide/apply"
          className="mt-8 inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Sign in to apply
        </Link>
      </div>
    );
  }

  const { data: latestRow } = await supabase
    .from("certification_applications")
    .select("id, status, submitted_at")
    .eq("host_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latest = latestRow as { id: string; status: ApplicationStatus; submitted_at: string } | null;

  const { data: openCandidate } = await supabase
    .from("guide_candidates")
    .select("id, status")
    .eq("host_id", user.id)
    .not("status", "in", "(withdrawn,not_certified)")
    .limit(1)
    .maybeSingle();

  const errorText = searchParams?.error ? ERROR_TEXT[searchParams.error] ?? "Something went wrong." : null;

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-prose px-5 py-20">
      <Link href="/certified-guide" className="label text-muted hover:text-seal">
        &larr; Certified AVAIA Guide
      </Link>
      <p className="label mb-3 mt-6">Apply</p>
      {children}
    </div>
  );

  // Already a candidate: nothing to apply for.
  if (openCandidate) {
    return shell(
      <>
        <h1 className="font-serif text-4xl text-ink">You are a Certification Candidate</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          Being a Candidate means you are on the certification path. It is not certification itself. Certification is a separate decision
          AVAIA makes later, from what you demonstrate along the way.
        </p>
        <Link
          href="/certification"
          className="mt-8 inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Open my certification classroom
        </Link>
      </>
    );
  }

  if (latest && latest.status === "pending_payment_method") {
    return shell(
      <>
        <h1 className="font-serif text-4xl text-ink">One step left: save a payment method</h1>
        {searchParams?.saved === "1" && (
          <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
            Thank you. We are confirming your payment method. Refresh this page in a moment.
          </p>
        )}
        {searchParams?.cancelled === "1" && (
          <p className="mt-6 rounded-md border border-rule px-4 py-3 text-sm text-muted">Nothing was saved. You can try again whenever you are ready.</p>
        )}
        {errorText && <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{errorText}</p>}
        <p className="mt-4 text-lg leading-relaxed text-ink">Your application is saved. To finish, save a payment method on our secure card page.</p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          <strong>Nothing is charged now.</strong> A person at AVAIA reviews your application and decides on admission. Only if you are admitted is the{" "}
          {ADMISSION_AMOUNT_LABEL} certification payment charged to this method, once. If you are not admitted, you are not charged and the saved method is removed.
        </p>
        <form action={continueToPaymentMethod}>
          <input type="hidden" name="applicationId" value={latest.id} />
          <button
            type="submit"
            className="mt-8 rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Save a payment method
          </button>
        </form>
      </>
    );
  }

  if (latest && latest.status === "ready_for_review") {
    return shell(
      <>
        <h1 className="font-serif text-4xl text-ink">Your application is under review</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          A person at AVAIA is reviewing your application and will decide on admission. Nothing has been charged. AVAIA will be in touch with you directly.
        </p>
        <p className="mt-4 text-muted">
          Admission would make you a Certification Candidate. It would not be certification, which is a separate decision made later.
        </p>
      </>
    );
  }

  if (latest && latest.status === "admitted") {
    return shell(
      <>
        <h1 className="font-serif text-4xl text-ink">You have been admitted</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          AVAIA has admitted you as a Certification Candidate. That is admission to the path, not certification.
        </p>
        <Link
          href="/certification"
          className="mt-8 inline-block rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Open my certification classroom
        </Link>
      </>
    );
  }

  if (latest && latest.status === "not_admitted") {
    return shell(
      <>
        <h1 className="font-serif text-4xl text-ink">Your application has been reviewed</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          AVAIA will be in touch with you directly. You have not been charged.
        </p>
        <Link
          href="/contact?reason=certification"
          className="mt-8 inline-block rounded-md border border-rule px-5 py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-seal"
        >
          Contact AVAIA
        </Link>
      </>
    );
  }

  return shell(
    <>
      <h1 className="font-serif text-4xl text-ink">Apply to the Guide certification path</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        There is no application fee. After you apply, you will save a payment method on our secure card page. <strong>Nothing is charged then.</strong>
      </p>
      <p className="mt-4 text-lg leading-relaxed text-muted">
        A person at AVAIA reviews every application and decides on admission. Only if you are admitted is the {ADMISSION_AMOUNT_LABEL} certification payment
        charged, once, to the method you saved. If you are not admitted, you are not charged and the saved method is removed.
      </p>
      <p className="mt-4 rounded-lg border border-seal/40 bg-seal/[0.06] px-5 py-4 text-ink">
        Admission makes you a Certification Candidate. It is not certification. Certification is a separate decision, made later by people, from what you
        demonstrate.
      </p>

      {errorText && <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{errorText}</p>}

      <form action={submitApplication} className="mt-10 space-y-6">
        <div>
          <label className="label mb-2 block" htmlFor="fullName">
            Your name
          </label>
          <input id="fullName" name="fullName" required className={inputClass} autoComplete="name" />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="contact">
            How to reach you (email or phone)
          </label>
          <input id="contact" name="contact" required defaultValue={user.email ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="whyInterested">
            Why are you interested in becoming a Guide?
          </label>
          <textarea id="whyInterested" name="whyInterested" required rows={4} className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="workContext">
            What work or community do you do?
          </label>
          <textarea id="workContext" name="workContext" required rows={3} className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className="label mb-2 block" htmlFor="howUseAvaia">
            How do you imagine using AVAIA?
          </label>
          <textarea id="howUseAvaia" name="howUseAvaia" required rows={3} className={`${inputClass} resize-none`} />
        </div>
        <fieldset>
          <legend className="label mb-2">What is this for?</legend>
          <div className="space-y-2">
            {PATHWAYS.map((p, i) => (
              <label key={p} className="flex items-center gap-3 text-ink">
                <input type="radio" name="pathway" value={p} required defaultChecked={i === 0} />
                {PATHWAY_LABEL[p]}
              </label>
            ))}
          </div>
          <label className="label mb-2 mt-4 block" htmlFor="pathwayNote">
            Anything to add about this (optional)
          </label>
          <textarea id="pathwayNote" name="pathwayNote" rows={2} className={`${inputClass} resize-none`} />
        </fieldset>
        <label className="flex items-start gap-3 text-ink">
          <input type="checkbox" name="orientationAgreed" required className="mt-1.5" />
          <span>I agree to receive orientation from AVAIA about the certification path.</span>
        </label>
        <button
          type="submit"
          className="rounded-md bg-seal px-6 py-3 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
        >
          Apply and continue to save a payment method
        </button>
      </form>
    </>
  );
}
