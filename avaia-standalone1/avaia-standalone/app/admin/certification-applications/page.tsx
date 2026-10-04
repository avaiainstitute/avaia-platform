import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ADMISSION_AMOUNT_LABEL, PATHWAY_LABEL, type ApplicationStatus } from "@/lib/certification-admissions";
import {
  admitApplication,
  chargeAdmission,
  declineApplication,
  getApplicationDetails,
  markDenialHandled,
  type ApplicationDetail,
} from "@/lib/ops/certification-admissions";

export const metadata = { title: "Certification Applications, AVAIA Admin" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GATE 1 of Guide certification (Decision 0004): the human admission decision.
//
//   Admission decision  ->  Candidate
//   Certification decision (made elsewhere, later)  ->  AVAIA Certified Guide
//
// Admitting someone makes them a Certification Candidate and gives them the
// access they need to complete the path. It is not a promise of certification.
// The standard payment is charged here, once, only after you admit.

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin/certification-applications");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return user.id;
}

const done = (message: string, kind: "saved" | "error" = "saved") => redirect(`/admin/certification-applications?${kind}=${encodeURIComponent(message)}`);

function origin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.avaiainstitute.com";
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

async function admitAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  if (formData.get("confirmAgreement") !== "on") done("Confirm the candidate agreement is in place before admitting.", "error");
  if (formData.get("confirmGates") !== "on") done("Confirm you understand that admission is not certification.", "error");
  const result = await admitApplication({ applicationId, adminId: actor, note: String(formData.get("note") ?? "").trim(), origin: origin() });
  if (!result.ok) done(result.error, "error");
  else if (result.charged) done("Admitted as a Candidate. The certification payment was charged.");
  else done(`Admitted as a Candidate. The certification payment did not go through (${result.chargeFailure ?? "unknown"}). The admission stands; retry the charge below.`);
}

async function declineAction(formData: FormData) {
  "use server";
  const actor = await requireAdmin();
  const result = await declineApplication({ applicationId: String(formData.get("applicationId") ?? ""), adminId: actor, note: String(formData.get("note") ?? "").trim() });
  if (!result.ok) done(result.error, "error");
  done("Recorded as not admitted. Nobody was charged and the saved payment method was removed. No message was sent.");
}

async function retryChargeAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const result = await chargeAdmission(String(formData.get("applicationId") ?? ""));
  if (!result.ok) done(result.error, "error");
  else if (result.charged) done("The certification payment was charged.");
  else done(`The charge did not go through again (${result.failure ?? "unknown"}).`, "error");
}

async function handledAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const result = await markDenialHandled(String(formData.get("applicationId") ?? ""));
  if (!result.ok) done(result.error, "error");
  done("Marked handled.");
}

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending_payment_method: "Started, no payment method saved yet",
  ready_for_review: "Ready for your admission decision",
  admitted: "Admitted as a Candidate",
  not_admitted: "Not admitted",
};

function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-3">
      <p className="label text-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-ink">{text}</p>
    </div>
  );
}

function ApplicationCard({ a }: { a: ApplicationDetail }) {
  const fieldClass = "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink";
  return (
    <div className="rounded-lg border border-rule bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-xl text-ink">{a.fullName}</p>
        <span className="label text-seal">{STATUS_LABEL[a.status]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {a.email} &middot; {a.contact} &middot; applied {new Date(a.submittedAt).toLocaleDateString()}
      </p>
      {a.previouslyNotAdmitted && <p className="mt-2 text-sm text-muted">This person was not admitted on an earlier application. Reapplication is not a decided policy; you decide this one as you would any other.</p>}
      <Answer label="Why interested" text={a.whyInterested} />
      <Answer label="Work or community" text={a.workContext} />
      <Answer label="How they imagine using AVAIA" text={a.howUseAvaia} />
      <Answer label="What it is for" text={`${PATHWAY_LABEL[a.pathway]}${a.pathwayNote ? `: ${a.pathwayNote}` : ""}`} />
      {a.decisionNote && <Answer label="Your decision note" text={a.decisionNote} />}

      {a.status === "ready_for_review" && (
        <div className="mt-6 grid gap-6 border-t border-rule pt-6 sm:grid-cols-2">
          <form action={admitAction} className="space-y-3">
            <input type="hidden" name="applicationId" value={a.id} />
            <p className="label text-muted">Admit as a Candidate</p>
            <p className="text-sm text-muted">
              Creates their candidacy, opens the access they need, then charges {ADMISSION_AMOUNT_LABEL} once to the method they saved. This is not certification.
            </p>
            <textarea name="note" rows={2} className={`${fieldClass} resize-none`} placeholder="Note (optional)" />
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="confirmAgreement" className="mt-1" />
              The candidate agreement is in place.
            </label>
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="confirmGates" className="mt-1" />
              I understand admission makes a Candidate, not a Certified Guide.
            </label>
            <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
              Admit and charge {ADMISSION_AMOUNT_LABEL}
            </button>
          </form>
          <form action={declineAction} className="space-y-3">
            <input type="hidden" name="applicationId" value={a.id} />
            <p className="label text-muted">Do not admit</p>
            <p className="text-sm text-muted">
              Nobody is charged and the saved payment method is removed. No message is sent: what they are told is yours to decide.
            </p>
            <textarea name="note" rows={2} className={`${fieldClass} resize-none`} placeholder="Note (optional)" />
            <button type="submit" className="rounded-md border border-rule px-4 py-2 font-sans text-sm text-ink hover:border-seal">
              Record: not admitted
            </button>
          </form>
        </div>
      )}

      {a.status === "admitted" && (
        <div className="mt-6 border-t border-rule pt-6 text-sm">
          <p className="text-ink">
            Payment:{" "}
            {a.chargeStatus === "charged"
              ? `${ADMISSION_AMOUNT_LABEL} charged.`
              : a.chargeStatus === "charging"
                ? "A charge attempt is in progress or did not finish. Check Stripe before retrying."
                : `not charged${a.chargeFailure ? ` (${a.chargeFailure})` : ""}. The admission stands.`}
          </p>
          {(a.chargeStatus === "failed" || a.chargeStatus === "not_charged") && (
            <form action={retryChargeAction} className="mt-3">
              <input type="hidden" name="applicationId" value={a.id} />
              <button type="submit" className="rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] hover:opacity-90">
                Retry the {ADMISSION_AMOUNT_LABEL} charge
              </button>
            </form>
          )}
          {a.candidateId && (
            <p className="mt-3">
              <Link href={`/admin/guide-candidates/${a.candidateId}`} className="text-seal hover:underline">
                Open the candidate
              </Link>
            </p>
          )}
        </div>
      )}

      {a.status === "not_admitted" && (
        <div className="mt-6 border-t border-rule pt-6 text-sm">
          <p className="text-ink">
            {a.denialHandled
              ? "You marked this handled."
              : "What they are told, whether they can reapply, and any refund are not decided. This stays in What Needs Dorian until you mark it handled."}
          </p>
          {!a.denialHandled && (
            <form action={handledAction} className="mt-3">
              <input type="hidden" name="applicationId" value={a.id} />
              <button type="submit" className="rounded-md border border-rule px-4 py-2 font-sans text-sm text-ink hover:border-seal">
                Mark handled
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default async function AdminCertificationApplicationsPage({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  await requireAdmin();
  const applications = await getApplicationDetails();
  const order: ApplicationStatus[] = ["ready_for_review", "admitted", "pending_payment_method", "not_admitted"];
  const sorted = [...applications].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status));

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="mb-6">
        <Link href="/admin/operations" className="label hover:text-seal">
          &larr; Back to Operations
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">Certification Applications</h1>
      <p className="mt-4 text-lg text-muted">
        Gate 1 of two. You decide admission here: admitting makes someone a Certification Candidate and opens the access they need. It is not a promise of
        certification. Certification is its own decision, made later on the candidate&rsquo;s page, from recorded evidence.
      </p>
      {searchParams.saved && <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">{searchParams.saved}</p>}
      {searchParams.error && <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">{searchParams.error}</p>}
      <div className="mt-8 space-y-6">
        {sorted.length === 0 ? <p className="text-muted">No applications yet.</p> : sorted.map((a) => <ApplicationCard key={a.id} a={a} />)}
      </div>
    </div>
  );
}
