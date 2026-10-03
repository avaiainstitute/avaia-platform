import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadStatusForCertification,
  loadCeCredits,
  loadFeePayments,
  loadCategories,
  loadPolicy,
  confirmRenewal,
  confirmReactivation,
  recordCeCredit,
  setCeCreditStatus,
  recordFeePayment,
  describeEthics,
  describePayment,
  formatDateLabel,
  formatMoney,
  LIFECYCLE_LABEL,
  PROGRAM_AUTHORIZATION_KEYS,
  PROGRAM_AUTHORIZATION_LABEL,
  type ActionResult,
} from "@/lib/certification-renewal";

export const metadata = { title: "Guide Certification, AVAIA Admin" };
export const dynamic = "force-dynamic";

// One Guide's renewal cycle, continuing education, fee payments, and
// reactivation. Every button here is a human decision: nothing on this page
// (or anywhere else) certifies, recertifies, renews, or reactivates on its
// own, and good standing is only ever attested here by a person. All writes
// go through the signed-in admin's own RLS-bound client (admin-all policies,
// migration 0082); createAdminClient() is used only to show the Guide's
// email.

async function requireAdminUser(certificationId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?from=/admin/guide-certifications/${certificationId}`);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  return { supabase, user };
}

function back(certificationId: string, result: ActionResult): never {
  const base = `/admin/guide-certifications/${certificationId}`;
  if (result.ok) redirect(`${base}?notice=${encodeURIComponent(result.message)}`);
  redirect(`${base}?error=${encodeURIComponent(result.message)}`);
}

async function confirmRenewalAction(formData: FormData) {
  "use server";
  const certificationId = String(formData.get("certificationId") ?? "");
  const { supabase, user } = await requireAdminUser(certificationId);
  back(certificationId, await confirmRenewal(supabase, certificationId, user.id));
}

async function confirmReactivationAction(formData: FormData) {
  "use server";
  const certificationId = String(formData.get("certificationId") ?? "");
  const { supabase, user } = await requireAdminUser(certificationId);
  const attested = formData.get("attested") === "on";
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  back(certificationId, await confirmReactivation(supabase, certificationId, user.id, { attested, note }));
}

async function recordCeAction(formData: FormData) {
  "use server";
  const certificationId = String(formData.get("certificationId") ?? "");
  const { supabase, user } = await requireAdminUser(certificationId);
  back(
    certificationId,
    await recordCeCredit(
      supabase,
      {
        certificationId,
        title: String(formData.get("title") ?? ""),
        provider: String(formData.get("provider") ?? ""),
        category: String(formData.get("category") ?? ""),
        credits: Number(formData.get("credits") ?? ""),
        completedOn: String(formData.get("completedOn") ?? ""),
        programAuthorizationKey: String(formData.get("programAuthorizationKey") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        approveNow: formData.get("approveNow") === "on",
      },
      user.id
    )
  );
}

async function setCeStatusAction(formData: FormData) {
  "use server";
  const certificationId = String(formData.get("certificationId") ?? "");
  const { supabase, user } = await requireAdminUser(certificationId);
  const creditId = String(formData.get("creditId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "approved" && status !== "rejected") back(certificationId, { ok: false, code: "status", message: "Invalid status." });
  back(certificationId, await setCeCreditStatus(supabase, creditId, status as "approved" | "rejected", user.id));
}

async function recordFeeAction(formData: FormData) {
  "use server";
  const certificationId = String(formData.get("certificationId") ?? "");
  const { supabase, user } = await requireAdminUser(certificationId);
  back(
    certificationId,
    await recordFeePayment(
      supabase,
      {
        certificationId,
        feeType: String(formData.get("feeType") ?? ""),
        amountDollars: Number(formData.get("amountDollars") ?? ""),
        surchargeDollars: Number(formData.get("surchargeDollars") || 0),
        paidOn: String(formData.get("paidOn") ?? ""),
        reference: String(formData.get("reference") ?? ""),
      },
      user.id
    )
  );
}

const inputClass =
  "w-full rounded-md border border-rule bg-white/[0.04] px-3 py-2 text-sm text-ink outline-none focus:border-seal";
const buttonClass =
  "rounded-md bg-seal px-4 py-2 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90";
const quietButtonClass =
  "rounded-md border border-rule px-3 py-1.5 font-sans text-xs text-ink transition-colors hover:border-seal";

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex gap-2">
      <span className={ok ? "text-seal" : "text-[#e0857d]"}>{ok ? "Met" : "Not met"}</span>
      <span className="text-ink">{label}</span>
    </li>
  );
}

export default async function AdminGuideCertificationPage({
  params,
  searchParams,
}: {
  params: { certificationId: string };
  searchParams?: { notice?: string; error?: string };
}) {
  const { supabase } = await requireAdminUser(params.certificationId);
  const status = await loadStatusForCertification(supabase, params.certificationId);
  if (!status) notFound();

  const [credits, payments, categories, policy] = await Promise.all([
    loadCeCredits(supabase, params.certificationId),
    loadFeePayments(supabase, params.certificationId),
    loadCategories(supabase),
    loadPolicy(supabase),
  ]);

  let email: string | null = null;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(status.hostId);
    email = data?.user?.email ?? null;
  } catch {
    email = null;
  }

  const categoryLabel = new Map(categories.map((c) => [c.key, c.label]));
  const today = new Date().toISOString().slice(0, 10);
  const isActive = status.standing === "active";
  const isInactive = status.standing === "inactive";
  const defaultFeeType = isInactive ? "reactivation" : "annual_renewal";
  const defaultFeeDollars = isInactive
    ? (status.payment.feeDueCents ?? policy.reactivationBaseFeeCents) / 100
    : policy.annualRenewalFeeCents / 100;

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="mb-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/admin/guide-certifications" className="label hover:text-seal">
          ← All Guide Certifications
        </Link>
        <Link href={`/admin/guide-candidates/${status.candidateId}`} className="label hover:text-seal">
          Candidate record →
        </Link>
      </p>
      <p className="label mb-3">AVAIA Admin</p>
      <h1 className="font-serif text-4xl text-ink">{email ?? status.hostId}</h1>
      <p className="mt-3 text-lg text-muted">{LIFECYCLE_LABEL[status.lifecycle]}</p>

      {searchParams?.notice && (
        <p className="mt-6 rounded-md border border-seal/40 bg-seal/[0.06] px-4 py-3 text-sm text-ink">
          {searchParams.notice.slice(0, 300)}
        </p>
      )}
      {searchParams?.error && (
        <p className="mt-6 rounded-md border border-[#e0857d]/40 bg-[#e0857d]/[0.08] px-4 py-3 text-sm text-[#e0857d]">
          {searchParams.error.slice(0, 300)}
        </p>
      )}

      <section className="rule-t mt-12 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Cycle</p>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="label text-muted">Certified</dt>
            <dd className="mt-1 text-ink">{formatDateLabel(status.certifiedAt)}</dd>
          </div>
          <div>
            <dt className="label text-muted">Standing</dt>
            <dd className="mt-1 text-ink">{status.standing}</dd>
          </div>
          {status.cycleEndsAt && (
            <div>
              <dt className="label text-muted">Current period</dt>
              <dd className="mt-1 text-ink">
                {status.cycleStartedAt ? formatDateLabel(status.cycleStartedAt) : "?"} to {formatDateLabel(status.cycleEndsAt)}
                {isActive && status.daysRemaining !== null
                  ? status.daysRemaining > 0
                    ? `, ${status.daysRemaining} days remaining`
                    : ", ended"
                  : ""}
              </dd>
            </div>
          )}
          {status.lastRenewedAt && (
            <div>
              <dt className="label text-muted">Last renewed</dt>
              <dd className="mt-1 text-ink">{formatDateLabel(status.lastRenewedAt)}</dd>
            </div>
          )}
          {status.inactivity && (
            <div>
              <dt className="label text-muted">Inactive since</dt>
              <dd className="mt-1 text-ink">
                {formatDateLabel(status.inactivity.since)} ({status.inactivity.monthsInactive} month
                {status.inactivity.monthsInactive === 1 ? "" : "s"}). Reactivation window{" "}
                {status.inactivity.windowOpen ? "open until" : "closed on"} {formatDateLabel(status.inactivity.windowEndsAt)}.
              </dd>
            </div>
          )}
        </dl>
      </section>

      {isActive && (
        <section className="rule-t mt-10 border-t border-rule pt-8">
          <p className="label mb-3 text-muted">Renewal</p>
          <ul className="space-y-1 text-sm">
            <Check ok={status.renewal.standingOk} label="Good standing" />
            <Check ok={status.renewal.ceMet} label={`${status.ce.approvedInPeriod} of ${status.ce.requiredCredits} approved CE credits this period`} />
            <Check ok={status.renewal.mandatoryCategoriesMet} label="Any mandatory CE categories" />
            <Check ok={status.renewal.ethicsMet} label={`Ethics: ${describeEthics(status)}`} />
            <Check ok={status.renewal.paymentMet} label={describePayment(status)} />
          </ul>
          {!status.renewal.allMet && (
            <p className="mt-3 text-sm text-muted">{status.renewal.blockers.join(" ")}</p>
          )}
          <p className="mt-3 text-xs text-muted">
            Good standing here means the certification standing is Active. If you know of a standing concern,
            do not confirm. Payment alone is not renewal, and CE alone is not renewal.
          </p>
          <form action={confirmRenewalAction} className="mt-4">
            <input type="hidden" name="certificationId" value={status.certificationId} />
            <button type="submit" disabled={!status.renewal.allMet} className={`${buttonClass} disabled:opacity-40`}>
              Confirm renewal
            </button>
            {!status.periodEnded && status.renewal.allMet && (
              <span className="ml-3 text-xs text-muted">
                The new period starts at the current period&rsquo;s end date, so renewing early does not shorten the year.
              </span>
            )}
          </form>
        </section>
      )}

      {isInactive && status.inactivity && status.reactivation && (
        <section className="rule-t mt-10 border-t border-rule pt-8">
          <p className="label mb-3 text-muted">
            {status.reactivation.windowOpen ? "Reactivation" : "Recertification required"}
          </p>
          {!status.reactivation.windowOpen ? (
            <p className="text-sm text-ink">
              This certification has been inactive for the full {policy.reactivationWindowMonths}-month window. No
              payment, CE, or automation can restore it. It must go through the AVAIA certification process
              again. The historical record and Program Authorization history stay preserved.
            </p>
          ) : (
            <>
              <ul className="space-y-1 text-sm">
                <Check ok={status.reactivation.windowOpen} label="Inside the reactivation window" />
                <Check ok={status.ethics.metForRenewal} label={`Ethics: ${describeEthics(status)}`} />
                <Check ok={status.payment.status === "paid"} label={describePayment(status)} />
              </ul>
              <p className="mt-3 text-sm text-muted">
                CE since going inactive: {status.reactivation.approvedCeSinceInactive} approved credits.
                {status.inactivity.band === "surcharge"
                  ? ` Inactive more than ${policy.reactivationSurchargeAfterMonths} months: the reactivation fee is ${formatMoney(status.payment.feeDueCents ?? 0)} (${formatMoney(policy.reactivationBaseFeeCents)} plus a ${formatMoney(status.inactivity.surchargeCents)} extended-inactivity fee).`
                  : ""}
              </p>
              {status.reactivation.blockers.length > 0 && (
                <p className="mt-2 text-sm text-muted">{status.reactivation.blockers.join(" ")}</p>
              )}
              <form action={confirmReactivationAction} className="mt-4 space-y-3">
                <input type="hidden" name="certificationId" value={status.certificationId} />
                <label className="flex items-start gap-2 text-sm text-ink">
                  <input type="checkbox" name="attested" className="mt-1" />
                  <span>
                    I verified this Guide&rsquo;s good standing and that the applicable reactivation CE
                    requirement is satisfied. (The exact CE makeup is not encoded in the system; it is your
                    call.)
                  </span>
                </label>
                <textarea name="note" rows={2} placeholder="Optional note for the record" className={inputClass} />
                <button
                  type="submit"
                  disabled={!status.reactivation.systemChecksPass}
                  className={`${buttonClass} disabled:opacity-40`}
                >
                  Confirm reactivation
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">
          Continuing education ({status.ce.approvedInPeriod} of {status.ce.requiredCredits} approved this period,{" "}
          {status.ce.totalApprovedAllTime} approved in all)
        </p>
        {credits.length === 0 ? (
          <p className="text-sm text-muted">No CE records yet.</p>
        ) : (
          <div className="space-y-2">
            {credits.map((c) => (
              <div key={c.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-ink">{c.title}</span>
                  <span className="text-muted">
                    {c.credits} credit{c.credits === 1 ? "" : "s"} · {formatDateLabel(c.completed_on)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {categoryLabel.get(c.category) ?? c.category}
                  {c.provider ? ` · ${c.provider}` : ""}
                  {c.program_authorization_key
                    ? ` · Program Authorization: ${
                        PROGRAM_AUTHORIZATION_LABEL[c.program_authorization_key as keyof typeof PROGRAM_AUTHORIZATION_LABEL] ??
                        c.program_authorization_key
                      }`
                    : ""}
                  {" · "}
                  <span className="text-ink">{c.status}</span>
                </p>
                {c.notes && <p className="mt-1 text-xs text-muted">{c.notes}</p>}
                {c.status !== "approved" && (
                  <form action={setCeStatusAction} className="mt-2 flex gap-2">
                    <input type="hidden" name="certificationId" value={status.certificationId} />
                    <input type="hidden" name="creditId" value={c.id} />
                    <button type="submit" name="status" value="approved" className={quietButtonClass}>
                      Approve
                    </button>
                    {c.status === "recorded" && (
                      <button type="submit" name="status" value="rejected" className={quietButtonClass}>
                        Reject
                      </button>
                    )}
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        <form action={recordCeAction} className="mt-6 grid gap-3 rounded-lg border border-rule p-5 sm:grid-cols-2">
          <input type="hidden" name="certificationId" value={status.certificationId} />
          <p className="label text-muted sm:col-span-2">Record CE</p>
          <input name="title" required placeholder="Title" className={`${inputClass} sm:col-span-2`} />
          <input name="provider" placeholder="Provider (optional)" className={inputClass} />
          <select name="category" className={inputClass} defaultValue="general">
            {categories
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
          </select>
          <input name="credits" type="number" step="0.25" min="0.25" required placeholder="Credits" className={inputClass} />
          <input name="completedOn" type="date" required max={today} defaultValue={today} className={inputClass} />
          <select name="programAuthorizationKey" className={`${inputClass} sm:col-span-2`} defaultValue="">
            <option value="">Not Program Authorization training</option>
            {PROGRAM_AUTHORIZATION_KEYS.map((k) => (
              <option key={k} value={k}>
                Program Authorization training: {PROGRAM_AUTHORIZATION_LABEL[k]}
              </option>
            ))}
          </select>
          <textarea name="notes" rows={2} placeholder="Notes (optional)" className={`${inputClass} sm:col-span-2`} />
          <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
            <input type="checkbox" name="approveNow" /> Approve now
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonClass}>
              Save CE record
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">
          Recording a Program Authorization training here earns CE only. It does not grant or change the
          Program Authorization, which stays a separate action on the candidate record.
        </p>
      </section>

      <section className="rule-t mt-10 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Renewal and reactivation fees</p>
        <p className="mb-3 text-sm text-muted">{describePayment(status)}</p>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No fee payments recorded.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="rounded-lg border border-rule bg-white/[0.04] px-5 py-3 text-sm">
                <span className="text-ink">
                  {formatMoney(p.amount_cents)} {p.fee_type === "reactivation" ? "reactivation" : "annual renewal"}
                </span>
                <span className="ml-3 text-muted">
                  {formatDateLabel(p.paid_at)}
                  {p.surcharge_cents > 0 ? ` · includes ${formatMoney(p.surcharge_cents)} surcharge` : ""}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
        <form action={recordFeeAction} className="mt-6 grid gap-3 rounded-lg border border-rule p-5 sm:grid-cols-2">
          <input type="hidden" name="certificationId" value={status.certificationId} />
          <p className="label text-muted sm:col-span-2">Record a received payment</p>
          <select name="feeType" className={inputClass} defaultValue={defaultFeeType}>
            <option value="annual_renewal">Annual renewal</option>
            <option value="reactivation">Reactivation</option>
          </select>
          <input name="paidOn" type="date" required max={today} defaultValue={today} className={inputClass} />
          <input
            name="amountDollars"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultFeeDollars}
            placeholder="Amount paid (dollars)"
            className={inputClass}
          />
          <input
            name="surchargeDollars"
            type="number"
            step="0.01"
            min="0"
            placeholder="Surcharge portion (dollars, if any)"
            className={inputClass}
          />
          <input name="reference" placeholder="Reference (Stripe id, check number…)" className={`${inputClass} sm:col-span-2`} />
          <div className="sm:col-span-2">
            <button type="submit" className={buttonClass}>
              Record payment
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">
          Recording a payment does not renew or reactivate anything. It only marks the fee as received.
        </p>
      </section>
    </div>
  );
}
