import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { sendEmail, escapeHtml } from "@/lib/resend";
import { alertOps } from "@/lib/ops/alerts";
import { hostLabels } from "@/lib/ops/host-labels";
import type { CapabilityResult, NeedsItem } from "@/lib/ops/needs-dorian-core";
import {
  ADMISSION_AMOUNT_CENTS,
  ADMISSION_AMOUNT_LABEL,
  candidacyAccessMismatches,
  chargeIdempotencyKey,
  classifyApplications,
  mayAttemptCharge,
  shouldHoldCandidacyAccess,
  type ApplicationRecord,
  type ApplicationStatus,
  type ChargeStatus,
  type ValidApplication,
} from "@/lib/certification-admissions";

// CERTIFICATION ADMISSIONS (operations side): the I/O around the pure rules in
// lib/certification-admissions.ts. Called only from signed-in routes and from the
// admin screen after its own admin check.
//
// Two gates (Decision 0004): admitting someone makes them a Candidate and gives
// them the access they need to complete certification. It never certifies anyone.
// Nothing here evaluates or scores.

type Admin = ReturnType<typeof createAdminClient>;

type ApplicationRow = {
  id: string;
  host_id: string;
  status: ApplicationStatus;
  charge_status: ChargeStatus;
  charge_failure: string | null;
  denial_handled: boolean;
  submitted_at: string;
  payment_method_saved_at: string | null;
  decided_at: string | null;
  updated_at: string;
};

const APPLICATION_COLUMNS =
  "id, host_id, status, charge_status, charge_failure, denial_handled, submitted_at, payment_method_saved_at, decided_at, updated_at";

export async function getApplicationRecords(): Promise<ApplicationRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("certification_applications").select(APPLICATION_COLUMNS);
  const rows = (data ?? []) as ApplicationRow[];
  return rows.map((r) => ({
    id: r.id,
    hostId: r.host_id,
    status: r.status,
    chargeStatus: r.charge_status,
    chargeFailure: r.charge_failure,
    denialHandled: r.denial_handled,
    submittedAt: r.submitted_at,
    paymentMethodSavedAt: r.payment_method_saved_at,
    decidedAt: r.decided_at,
    updatedAt: r.updated_at,
    previouslyNotAdmitted: rows.some(
      (o) => o.id !== r.id && o.host_id === r.host_id && o.status === "not_admitted" && new Date(o.submitted_at).getTime() < new Date(r.submitted_at).getTime()
    ),
  }));
}

// ---------------------------------------------------------------------------
// Candidacy access: an entitlement tied to an active candidacy
// ---------------------------------------------------------------------------

async function applyCandidacyAccess(admin: Admin, hostId: string, hold: boolean, hasAnyActive: boolean, hasCandidacy: boolean): Promise<"granted" | "revoked" | "none"> {
  if (hold && !hasAnyActive) {
    const { error } = await admin.from("entitlements").insert({ host_id: hostId, status: "active", source: "candidacy" });
    return error ? "none" : "granted";
  }
  if (!hold && hasCandidacy) {
    const { error } = await admin
      .from("entitlements")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("host_id", hostId)
      .eq("source", "candidacy")
      .eq("status", "active");
    return error ? "none" : "revoked";
  }
  return "none";
}

/** Applies the candidacy-access rule to one person right now. Idempotent. Called
 *  at admission, on every candidacy status change, and when a certification is
 *  granted; the daily reconciliation is only the backstop. */
export async function syncCandidacyAccess(hostId: string): Promise<{ granted: number; revoked: number }> {
  const admin = createAdminClient();
  const [{ data: cands }, { data: certs }, { data: ents }] = await Promise.all([
    admin.from("guide_candidates").select("status").eq("host_id", hostId),
    admin.from("guide_certifications").select("id").eq("host_id", hostId).limit(1),
    admin.from("entitlements").select("source").eq("host_id", hostId).eq("status", "active"),
  ]);
  const hasCert = (certs ?? []).length > 0;
  const hold = ((cands ?? []) as { status: string }[]).some((c) => shouldHoldCandidacyAccess(c.status, hasCert));
  const entRows = (ents ?? []) as { source: string }[];
  const outcome = await applyCandidacyAccess(admin, hostId, hold, entRows.length > 0, entRows.some((e) => e.source === "candidacy"));
  return { granted: outcome === "granted" ? 1 : 0, revoked: outcome === "revoked" ? 1 : 0 };
}

async function loadAccessInputs(admin: Admin) {
  const [{ data: cands }, { data: certs }, { data: ents }] = await Promise.all([
    admin.from("guide_candidates").select("host_id, status"),
    admin.from("guide_certifications").select("host_id"),
    admin.from("entitlements").select("host_id, source").eq("status", "active"),
  ]);
  return {
    candidates: (cands ?? []) as { host_id: string; status: string }[],
    certifiedHostIds: new Set(((certs ?? []) as { host_id: string }[]).map((c) => c.host_id)),
    activeEntitlements: (ents ?? []) as { host_id: string; source: string }[],
  };
}

/** The daily backstop: finds any mismatch the synchronous paths missed and fixes it. */
export async function reconcileCandidacyAccess(): Promise<{ granted: number; revoked: number; checked: number }> {
  const admin = createAdminClient();
  const inputs = await loadAccessInputs(admin);
  const mismatches = candidacyAccessMismatches(inputs);
  let granted = 0;
  let revoked = 0;
  for (const m of mismatches) {
    const result = await syncCandidacyAccess(m.hostId);
    granted += result.granted;
    revoked += result.revoked;
  }
  return { granted, revoked, checked: inputs.candidates.length };
}

// ---------------------------------------------------------------------------
// The capability: applications + candidacy access, routed to What Needs Dorian
// ---------------------------------------------------------------------------

export async function evaluateCertificationAdmissions(): Promise<CapabilityResult> {
  const admin = createAdminClient();
  const records = await getApplicationRecords();
  const access = candidacyAccessMismatches(await loadAccessInputs(admin));
  const label = await hostLabels([...records.map((r) => r.hostId), ...access.map((a) => a.hostId)]);
  const classified = classifyApplications(records, label);
  const toItem = (i: { key: string; text: string; href: string }): NeedsItem => ({ key: i.key, text: i.text, href: i.href });
  const problems = classified.problems.map(toItem);
  for (const m of access) {
    problems.push({
      key: `candidacy_access:${m.hostId}:${m.kind}`,
      href: "/admin/guide-candidates",
      text:
        m.kind === "missing"
          ? `${label(m.hostId)}: an active certification candidate has no AVAIA access. The daily check grants it; if this stays, look at their candidacy.`
          : `${label(m.hostId)}: candidacy access is still active but the candidacy has ended. The daily check removes it; if this stays, look at their candidacy.`,
    });
  }
  return {
    key: "certification_admissions",
    label: "Certification Admissions & Candidate Access",
    evaluated: records.length + new Set(access.map((a) => a.hostId)).size,
    decisions: [...classified.decisions.map(toItem), ...classified.policy.map(toItem)],
    problems,
    watching: classified.watching.map(toItem),
  };
}

// ---------------------------------------------------------------------------
// Saving a payment method (Stripe setup mode): never charges
// ---------------------------------------------------------------------------

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

export async function startPaymentMethodSetup(args: { applicationId: string; hostId: string; email: string | null; origin: string }): Promise<Result<{ url: string }>> {
  if (!process.env.STRIPE_SECRET_KEY) return { ok: false, error: "Payments are not configured in this deployment." };
  const admin = createAdminClient();
  const { data: app } = await admin
    .from("certification_applications")
    .select("id, host_id, status, full_name, stripe_customer_id")
    .eq("id", args.applicationId)
    .maybeSingle();
  const row = app as { id: string; host_id: string; status: ApplicationStatus; full_name: string; stripe_customer_id: string | null } | null;
  if (!row || row.host_id !== args.hostId) return { ok: false, error: "Application not found." };
  if (row.status !== "pending_payment_method") return { ok: false, error: "A payment method has already been saved for this application." };
  try {
    let customerId = row.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: args.email || undefined,
        name: row.full_name,
        metadata: { supabase_user_id: args.hostId, application_id: row.id },
      });
      customerId = customer.id;
      await admin.from("certification_applications").update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq("id", row.id);
    }
    const session = await stripe().checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      client_reference_id: args.hostId,
      metadata: { product: "certification_application_setup", application_id: row.id, supabase_user_id: args.hostId },
      setup_intent_data: { metadata: { application_id: row.id, supabase_user_id: args.hostId } },
      success_url: `${args.origin}/certified-guide/apply?saved=1`,
      cancel_url: `${args.origin}/certified-guide/apply?cancelled=1`,
    });
    if (!session.url) throw new Error("Stripe did not return a URL.");
    await admin.from("certification_applications").update({ stripe_setup_session_id: session.id, updated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("AVAIA certification application: payment method setup failed:", e);
    return { ok: false, error: "We could not open the secure card page. Please try again." };
  }
}

/** Webhook: the person saved a payment method. Nothing is charged. The
 *  application becomes ready for a human admission decision. Idempotent. */
export async function completePaymentMethodSetup(session: { id: string; setup_intent?: unknown; customer?: unknown; metadata?: Record<string, string> | null }): Promise<void> {
  const applicationId = session.metadata?.application_id;
  if (!applicationId) return;
  const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : (session.setup_intent as { id?: string } | null)?.id;
  if (!setupIntentId) {
    await alertOps("Certification application: payment method saved but unreadable", [`Application: ${applicationId}`, `Stripe session: ${session.id}`, "The card step finished but Stripe returned no setup intent. Check Stripe and the application."]);
    return;
  }
  const setupIntent = await stripe().setupIntents.retrieve(setupIntentId);
  const paymentMethodId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id ?? null;
  if (!paymentMethodId) {
    await alertOps("Certification application: no payment method on the setup", [`Application: ${applicationId}`, `Stripe session: ${session.id}`]);
    return;
  }
  const customerId = typeof session.customer === "string" ? session.customer : (session.customer as { id?: string } | null)?.id ?? null;
  if (customerId) {
    try {
      await stripe().customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId } });
    } catch (e) {
      console.error("AVAIA certification application: could not set default payment method:", e);
    }
  }
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin
    .from("certification_applications")
    .update({ status: "ready_for_review", stripe_payment_method_id: paymentMethodId, payment_method_saved_at: now, updated_at: now })
    .eq("id", applicationId)
    .eq("status", "pending_payment_method");
}

// ---------------------------------------------------------------------------
// Gate 1: the human admission decision
// ---------------------------------------------------------------------------

async function emailForHost(admin: Admin, hostId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(hostId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

/** Charges the standard certification payment to the saved method. Only ever for
 *  an admitted application, never twice (a claim on charge_status plus a Stripe
 *  idempotency key per attempt). A failure is recorded and surfaced; it never
 *  revokes the admission. */
export async function chargeAdmission(applicationId: string): Promise<Result<{ charged: boolean; failure?: string }>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("certification_applications")
    .select("id, host_id, status, charge_status, charge_attempts, stripe_customer_id, stripe_payment_method_id")
    .eq("id", applicationId)
    .maybeSingle();
  const app = data as {
    id: string;
    host_id: string;
    status: ApplicationStatus;
    charge_status: ChargeStatus;
    charge_attempts: number;
    stripe_customer_id: string | null;
    stripe_payment_method_id: string | null;
  } | null;
  if (!app) return { ok: false, error: "Application not found." };
  if (!mayAttemptCharge(app.status, app.charge_status)) return { ok: false, error: "A charge cannot be attempted for this application right now (not admitted, already charged, or an attempt is in progress)." };

  const attemptNumber = app.charge_attempts + 1;
  const { data: claimed } = await admin
    .from("certification_applications")
    .update({ charge_status: "charging", charge_attempts: attemptNumber, updated_at: new Date().toISOString() })
    .eq("id", app.id)
    .eq("status", "admitted")
    .in("charge_status", ["not_charged", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: "Another charge attempt is already in progress or complete." };

  const recordFailure = async (failure: string) => {
    await admin
      .from("certification_applications")
      .update({ charge_status: "failed", charge_failure: failure.slice(0, 300), updated_at: new Date().toISOString() })
      .eq("id", app.id);
    return { ok: true as const, charged: false, failure };
  };

  if (!app.stripe_customer_id || !app.stripe_payment_method_id) return recordFailure("No saved payment method on this application.");
  try {
    const email = await emailForHost(admin, app.host_id);
    const intent = await stripe().paymentIntents.create(
      {
        amount: ADMISSION_AMOUNT_CENTS,
        currency: "usd",
        customer: app.stripe_customer_id,
        payment_method: app.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: "AVAIA Certification (standard), charged after admission",
        receipt_email: email ?? undefined,
        metadata: { product: "guide_certification_admission", application_id: app.id, supabase_user_id: app.host_id },
      },
      { idempotencyKey: chargeIdempotencyKey(app.id, attemptNumber) }
    );
    if (intent.status === "succeeded") {
      const now = new Date().toISOString();
      await admin
        .from("certification_applications")
        .update({ charge_status: "charged", charge_payment_intent_id: intent.id, charged_at: now, charge_failure: null, updated_at: now })
        .eq("id", app.id);
      return { ok: true, charged: true };
    }
    return recordFailure(`The payment did not complete (status: ${intent.status}).`);
  } catch (e) {
    return recordFailure(e instanceof Error ? e.message : String(e));
  }
}

function admissionEmailHtml(args: { classroomUrl: string; charged: boolean }): string {
  const payment = args.charged
    ? `<p>The ${ADMISSION_AMOUNT_LABEL} certification payment was charged to the payment method you saved. Stripe will email you a receipt.</p>`
    : `<p>We could not complete the ${ADMISSION_AMOUNT_LABEL} certification payment with the payment method you saved. AVAIA will be in touch directly about it. Your admission is not affected.</p>`;
  return `
    <p>AVAIA has reviewed your application and admitted you as a Certification Candidate.</p>
    <p>Admission means you can begin the certification path. It is not certification. Certification is a separate decision AVAIA makes later, from what you demonstrate along the way.</p>
    ${payment}
    <p>Your classroom is ready: <a href="${escapeHtml(args.classroomUrl)}">Open my certification classroom</a>.</p>
    <p>Welcome.</p>
  `.trim();
}

export type AdmitResult = { ok: true; candidateId: string; charged: boolean; chargeFailure?: string } | { ok: false; error: string };

/** Records the admission decision (Gate 1) and does everything it means: creates
 *  the candidacy, records the candidate agreement, opens candidacy access, then
 *  charges the standard payment. The charge happens only here, only after the
 *  human decision. Admission is not certification. */
export async function admitApplication(args: { applicationId: string; adminId: string; note: string; origin: string }): Promise<AdmitResult> {
  const admin = createAdminClient();
  const { data } = await admin.from("certification_applications").select("id, host_id, status").eq("id", args.applicationId).maybeSingle();
  const app = data as { id: string; host_id: string; status: ApplicationStatus } | null;
  if (!app) return { ok: false, error: "Application not found." };
  if (app.status !== "ready_for_review") return { ok: false, error: "This application is not waiting for an admission decision." };

  const { data: candidate, error: candidateError } = await admin
    .from("guide_candidates")
    .insert({ host_id: app.host_id, admitted_by: args.adminId, notes: args.note || null })
    .select("id")
    .single();
  if (candidateError || !candidate) {
    return {
      ok: false,
      error: candidateError?.code === "23505" ? "This person already has an open candidacy." : "Could not create the candidacy. Please try again.",
    };
  }
  const candidateId = (candidate as { id: string }).id;

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("certification_applications")
    .update({ status: "admitted", decided_at: now, decided_by: args.adminId, decision_note: args.note || null, candidate_id: candidateId, updated_at: now })
    .eq("id", app.id)
    .eq("status", "ready_for_review")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    await admin.from("guide_candidates").delete().eq("id", candidateId);
    return { ok: false, error: "This application was decided by someone else just now." };
  }

  await admin.from("guide_candidate_history").insert({
    candidate_id: candidateId,
    entry_type: "status_change",
    body: `Admitted as a certification candidate after review of their application.${args.note ? `\n\n${args.note}` : ""}\n\nAdmission is not certification.`,
    recorded_by: args.adminId,
  });
  await admin.from("guide_candidate_evidence").insert({
    candidate_id: candidateId,
    evidence_type: "candidate_agreement",
    rating: "competent",
    summary: "Candidate agreement confirmed by the admitting reviewer at admission.",
    recorded_by: args.adminId,
  });
  await syncCandidacyAccess(app.host_id);

  const charge = await chargeAdmission(app.id);
  const charged = charge.ok && charge.charged;
  const chargeFailure = charge.ok ? charge.failure : charge.error;

  try {
    const email = await emailForHost(admin, app.host_id);
    if (email) {
      await sendEmail({
        to: email,
        subject: "You have been admitted as an AVAIA Certification Candidate",
        html: admissionEmailHtml({ classroomUrl: `${args.origin}/certification`, charged }),
        context: "certification_admission",
      });
    }
  } catch (e) {
    console.error("AVAIA certification admission: email failed:", e);
  }

  return { ok: true, candidateId, charged, chargeFailure: charged ? undefined : chargeFailure };
}

/** Records a decision not to admit. Nobody is charged and the saved payment
 *  method is removed. No message is sent: what a person is told, whether they can
 *  reapply, and any refund are not decided, so the application stays in What
 *  Needs Dorian until the owner marks it handled. */
export async function declineApplication(args: { applicationId: string; adminId: string; note: string }): Promise<Result> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("certification_applications")
    .select("id, status, stripe_payment_method_id")
    .eq("id", args.applicationId)
    .maybeSingle();
  const app = data as { id: string; status: ApplicationStatus; stripe_payment_method_id: string | null } | null;
  if (!app) return { ok: false, error: "Application not found." };
  if (app.status !== "ready_for_review") return { ok: false, error: "This application is not waiting for an admission decision." };

  const now = new Date().toISOString();
  const { data: claimed } = await admin
    .from("certification_applications")
    .update({
      status: "not_admitted",
      charge_status: "not_applicable",
      decided_at: now,
      decided_by: args.adminId,
      decision_note: args.note || null,
      stripe_payment_method_id: null,
      updated_at: now,
    })
    .eq("id", app.id)
    .eq("status", "ready_for_review")
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: false, error: "This application was decided by someone else just now." };

  if (app.stripe_payment_method_id) {
    try {
      await stripe().paymentMethods.detach(app.stripe_payment_method_id);
    } catch (e) {
      console.error("AVAIA certification application: could not detach payment method:", e);
      await alertOps("A saved payment method could not be removed", [
        `Application: ${app.id}`,
        `Payment method: ${app.stripe_payment_method_id}`,
        "The applicant was not admitted and was never charged, but Stripe did not remove their saved card. Remove it in Stripe.",
      ]);
    }
  }
  return { ok: true };
}

export async function markDenialHandled(applicationId: string): Promise<Result> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("certification_applications")
    .update({ denial_handled: true, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("status", "not_admitted");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type ApplicationDetail = ValidApplicationView & {
  id: string;
  hostId: string;
  status: ApplicationStatus;
  chargeStatus: ChargeStatus;
  chargeFailure: string | null;
  denialHandled: boolean;
  submittedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  candidateId: string | null;
  email: string | null;
  previouslyNotAdmitted: boolean;
};

type ValidApplicationView = Pick<ValidApplication, "fullName" | "contact" | "whyInterested" | "workContext" | "howUseAvaia" | "pathway" | "pathwayNote">;

/** Everything the admin screen shows about each application (the applicant's own
 *  answers, which they wrote for this purpose; no conversation content). */
export async function getApplicationDetails(): Promise<ApplicationDetail[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("certification_applications")
    .select(
      "id, host_id, status, charge_status, charge_failure, denial_handled, submitted_at, decided_at, decision_note, candidate_id, full_name, contact, why_interested, work_context, how_use_avaia, pathway, pathway_note"
    )
    .order("submitted_at", { ascending: false });
  const rows = (data ?? []) as {
    id: string;
    host_id: string;
    status: ApplicationStatus;
    charge_status: ChargeStatus;
    charge_failure: string | null;
    denial_handled: boolean;
    submitted_at: string;
    decided_at: string | null;
    decision_note: string | null;
    candidate_id: string | null;
    full_name: string;
    contact: string;
    why_interested: string;
    work_context: string;
    how_use_avaia: string;
    pathway: ValidApplication["pathway"];
    pathway_note: string | null;
  }[];
  const emails = await hostLabels(rows.map((r) => r.host_id));
  return rows.map((r) => ({
    id: r.id,
    hostId: r.host_id,
    status: r.status,
    chargeStatus: r.charge_status,
    chargeFailure: r.charge_failure,
    denialHandled: r.denial_handled,
    submittedAt: r.submitted_at,
    decidedAt: r.decided_at,
    decisionNote: r.decision_note,
    candidateId: r.candidate_id,
    fullName: r.full_name,
    contact: r.contact,
    whyInterested: r.why_interested,
    workContext: r.work_context,
    howUseAvaia: r.how_use_avaia,
    pathway: r.pathway,
    pathwayNote: r.pathway_note,
    email: emails(r.host_id),
    previouslyNotAdmitted: rows.some((o) => o.id !== r.id && o.host_id === r.host_id && o.status === "not_admitted" && new Date(o.submitted_at).getTime() < new Date(r.submitted_at).getTime()),
  }));
}
