import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Guide certification renewal / CE / Inactive lifecycle -- the one place
// the locked policy (migration 0082's header) is turned into state. Every
// consumer (the Guide-facing status, the admin pages, the Guide Operations
// agent's cron, the Founder Digest) calls the same derivation below, so the
// rules cannot drift between them.
//
// What this module does NOT do, on purpose:
//   * It never certifies, admits, recertifies, or restores a certification
//     that has been inactive for the full reactivation window. The 60-month
//     rule is also enforced by a database trigger (0082), so a bug here
//     still cannot do it.
//   * It never approves a CE credit or decides good standing. Those are
//     human acts performed through the admin actions at the bottom, which
//     the admin pages call after their own admin-role check.
//   * It never touches guide_platform_authorizations. A lapsed Guide keeps
//     every authorization row (earned history); the access gates in
//     lib/guide.ts simply stop honoring them while certification is not
//     active.
//   * It invents no unresolved policy. The exact CE makeup for
//     reactivation, the Ethics curriculum/credit value, and any additional
//     mandatory CE category are not defined anywhere here.
//   * Payment never reactivates anything. The reactivation fee ($295, or
//     $395 total past 24 months inactive) is only one condition; CE, Ethics,
//     good standing and a human confirmation still govern.

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export type CertificationPolicy = {
  cycleDays: number;
  requiredCeCredits: number;
  annualRenewalFeeCents: number;
  ethicsIntervalMonths: number;
  reactivationWindowMonths: number;
  reactivationBaseFeeCents: number;
  reactivationSurchargeAfterMonths: number;
  /** Extended-inactivity fee added to the base fee once MORE than
   *  reactivationSurchargeAfterMonths months inactive ($100, so $395 total). */
  reactivationSurchargeCents: number;
  reminderDays: number[];
};

/** The owner-locked values. Used only if a policy row is missing or the
 *  table cannot be read (e.g. migration 0082 not yet applied), so the
 *  system fails to the LOCKED numbers rather than to nothing. */
export const DEFAULT_POLICY: CertificationPolicy = {
  cycleDays: 365,
  requiredCeCredits: 24,
  annualRenewalFeeCents: 29_500,
  ethicsIntervalMonths: 24,
  reactivationWindowMonths: 60,
  reactivationBaseFeeCents: 29_500,
  reactivationSurchargeAfterMonths: 24,
  reactivationSurchargeCents: 10_000,
  reminderDays: [90, 60, 30, 14, 7],
};

type PolicyRow = { key: string; int_value: number | null; text_value: string | null };

export async function loadPolicy(supabase: SupabaseClient): Promise<CertificationPolicy> {
  const { data, error } = await supabase.from("guide_certification_policy").select("key, int_value, text_value");
  if (error || !data) return DEFAULT_POLICY;
  const rows = new Map<string, PolicyRow>((data as PolicyRow[]).map((r) => [r.key, r]));
  const int = (key: string, fallback: number): number => {
    const v = rows.get(key)?.int_value;
    return typeof v === "number" ? v : fallback;
  };
  const reminders = (rows.get("renewal_reminder_days")?.text_value ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => b - a);
  return {
    cycleDays: int("cycle_days", DEFAULT_POLICY.cycleDays),
    requiredCeCredits: int("required_ce_credits", DEFAULT_POLICY.requiredCeCredits),
    annualRenewalFeeCents: int("annual_renewal_fee_cents", DEFAULT_POLICY.annualRenewalFeeCents),
    ethicsIntervalMonths: int("ethics_interval_months", DEFAULT_POLICY.ethicsIntervalMonths),
    reactivationWindowMonths: int("reactivation_window_months", DEFAULT_POLICY.reactivationWindowMonths),
    reactivationBaseFeeCents: int("reactivation_base_fee_cents", DEFAULT_POLICY.reactivationBaseFeeCents),
    reactivationSurchargeAfterMonths: int(
      "reactivation_surcharge_after_months",
      DEFAULT_POLICY.reactivationSurchargeAfterMonths
    ),
    reactivationSurchargeCents: int("reactivation_surcharge_cents", DEFAULT_POLICY.reactivationSurchargeCents),
    reminderDays: reminders.length ? reminders : DEFAULT_POLICY.reminderDays,
  };
}

export type CeCategory = {
  key: string;
  label: string;
  isEthics: boolean;
  requiredCreditsPerCycle: number | null;
  active: boolean;
};

const DEFAULT_CATEGORIES: CeCategory[] = [
  { key: "general", label: "General continuing education", isEthics: false, requiredCreditsPerCycle: null, active: true },
  { key: "ethics", label: "AVAIA Ethics", isEthics: true, requiredCreditsPerCycle: null, active: true },
];

export async function loadCategories(supabase: SupabaseClient): Promise<CeCategory[]> {
  const { data, error } = await supabase
    .from("guide_ce_categories")
    .select("key, label, is_ethics, required_credits_per_cycle, active");
  if (error || !data || data.length === 0) return DEFAULT_CATEGORIES;
  return (
    data as {
      key: string;
      label: string;
      is_ethics: boolean;
      required_credits_per_cycle: number | string | null;
      active: boolean;
    }[]
  ).map((c) => ({
    key: c.key,
    label: c.label,
    isEthics: c.is_ethics,
    requiredCreditsPerCycle: c.required_credits_per_cycle === null ? null : Number(c.required_credits_per_cycle),
    active: c.active,
  }));
}

// ---------------------------------------------------------------------------
// Date helpers (UTC; calendar-month math clamps to month end, matching how
// Postgres adds intervals, so the app and the database trigger agree on
// when the 60-month window closes)
// ---------------------------------------------------------------------------

export function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function addMonthsUtc(d: Date, months: number): Date {
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDayOfTargetMonth);
  return new Date(
    Date.UTC(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds())
  );
}

export function wholeMonthsBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (addMonthsUtc(from, months).getTime() > to.getTime()) months -= 1;
  return Math.max(0, months);
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatDateLabel(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** The reminder band a given number of days remaining falls in: the
 *  smallest configured threshold that is >= days remaining (e.g. 25 days
 *  with thresholds 90/60/30/14/7 -> 30). null when beyond the largest
 *  threshold, or already expired. */
export function reminderBandFor(daysRemaining: number | null, reminderDays: number[]): number | null {
  if (daysRemaining === null || daysRemaining <= 0) return null;
  const ascending = [...reminderDays].sort((a, b) => a - b);
  for (const d of ascending) {
    if (daysRemaining <= d) return d;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type Standing = "active" | "paused" | "revoked" | "inactive";

export type CertificationRow = {
  id: string;
  candidate_id: string;
  host_id: string;
  certified_at: string;
  standing: Standing;
  cycle_started_at: string | null;
  cycle_ends_at: string | null;
  inactive_since: string | null;
  last_renewed_at: string | null;
  recertification_required_at: string | null;
  standing_changed_at: string | null;
};

export const CERTIFICATION_COLUMNS =
  "id, candidate_id, host_id, certified_at, standing, cycle_started_at, cycle_ends_at, inactive_since, last_renewed_at, recertification_required_at, standing_changed_at";

export type CeCreditRow = {
  id: string;
  certification_id: string;
  host_id: string;
  title: string;
  provider: string | null;
  category: string;
  credits: number;
  completed_on: string;
  status: "recorded" | "approved" | "rejected";
  program_authorization_key: string | null;
  notes: string | null;
  approved_at: string | null;
  created_at: string;
};

export type FeePaymentRow = {
  id: string;
  certification_id: string;
  host_id: string;
  fee_type: "annual_renewal" | "reactivation";
  amount_cents: number;
  surcharge_cents: number;
  paid_at: string;
  reference: string | null;
};

export const PROGRAM_AUTHORIZATION_KEYS = [
  "defying-grief",
  "unsung-heroes",
  "view-from-above",
  "shared-room",
  "youth",
] as const;
export type ProgramAuthorizationKey = (typeof PROGRAM_AUTHORIZATION_KEYS)[number];

/** Owner-stated Program Authorization pricing, for display only. Nothing
 *  here creates, grants, or charges an authorization. */
export const PROGRAM_AUTHORIZATION_LABEL: Record<ProgramAuthorizationKey, string> = {
  "defying-grief": "Defying Grief (Standard Authorization)",
  "unsung-heroes": "Unsung Heroes (Standard Authorization)",
  "view-from-above": "The View from Above (Standard Authorization)",
  "shared-room": "Shared Room (Advanced Authorization)",
  youth: "Youth (Advanced Authorization)",
};

// ---------------------------------------------------------------------------
// Derived status
// ---------------------------------------------------------------------------

export type LifecycleState =
  /** Active, inside the current 365-day period. */
  | "active"
  /** Active, the period has ended, and every renewal requirement is met:
   *  waiting only on a human to confirm the renewal. NOT lapsed. */
  | "renewal_ready_awaiting_confirmation"
  /** Active, the period has ended, and requirements are NOT met: the next
   *  Guide Operations run marks it inactive. */
  | "lapse_pending"
  | "inactive_reactivatable"
  /** Inactive for the full reactivation window or longer. */
  | "recertification_required"
  | "paused"
  | "revoked";

export type CertificationStatus = {
  certificationId: string;
  candidateId: string;
  hostId: string;
  standing: Standing;
  lifecycle: LifecycleState;
  certifiedAt: string;
  /** Raw timestamps exactly as stored (used for optimistic-concurrency
   *  guards on writes, never reformatted). */
  cycleStartedAt: string | null;
  cycleEndsAt: string | null;
  inactiveSinceRaw: string | null;
  lastRenewedAt: string | null;
  recertificationRequiredAt: string | null;
  standingChangedAt: string | null;
  daysRemaining: number | null;
  periodEnded: boolean;
  ce: {
    requiredCredits: number;
    approvedInPeriod: number;
    pendingInPeriod: number;
    met: boolean;
    totalApprovedAllTime: number;
    categories: { key: string; label: string; approvedInPeriod: number; required: number | null; met: boolean }[];
  };
  ethics: {
    lastCompletedOn: string | null;
    basis: "ethics_course" | "certification_date";
    dueAt: string;
    /** current: not due before the period ends. due_this_period: falls due
     *  on or before the period ends (must be completed to renew). overdue:
     *  already past due. */
    state: "current" | "due_this_period" | "overdue";
    metForRenewal: boolean;
    currentNow: boolean;
  };
  payment: {
    kind: "annual_renewal" | "reactivation";
    /** null = no fee applies because the reactivation window has closed
     *  (recertification required). */
    feeDueCents: number | null;
    paidCents: number;
    status: "paid" | "partial" | "unpaid" | "not_determined";
  };
  renewal: {
    standingOk: boolean;
    ceMet: boolean;
    mandatoryCategoriesMet: boolean;
    ethicsMet: boolean;
    paymentMet: boolean;
    allMet: boolean;
    blockers: string[];
  };
  inactivity: null | {
    since: string;
    monthsInactive: number;
    windowEndsAt: string;
    windowOpen: boolean;
    band: "standard" | "surcharge";
    surchargeCents: number;
  };
  reactivation: null | {
    windowOpen: boolean;
    systemChecksPass: boolean;
    blockers: string[];
    /** The exact CE makeup for reactivation is an owner decision and is not
     *  encoded anywhere; a human must attest it (plus good standing) was
     *  verified before reactivation is confirmed. */
    requiresHumanAttestation: true;
    approvedCeSinceInactive: number;
  };
  nextReminderBand: number | null;
};

function sumCredits(credits: CeCreditRow[]): number {
  return credits.reduce((acc, c) => acc + Number(c.credits), 0);
}

/** Pure derivation. No I/O, no clock reads except the injected `now`. */
export function deriveCertificationStatus(input: {
  cert: CertificationRow;
  credits: CeCreditRow[];
  payments: FeePaymentRow[];
  policy: CertificationPolicy;
  categories: CeCategory[];
  now: Date;
}): CertificationStatus {
  const { cert, credits, payments, policy, categories, now } = input;

  const certifiedAt = new Date(cert.certified_at);
  const cycleStart = new Date(cert.cycle_started_at ?? cert.certified_at);
  const cycleEnd = cert.cycle_ends_at
    ? new Date(cert.cycle_ends_at)
    : addDaysUtc(cycleStart, policy.cycleDays);

  const periodEnded = cycleEnd.getTime() <= now.getTime();
  const daysRemaining = cert.standing === "active" || cert.standing === "paused"
    ? Math.ceil((cycleEnd.getTime() - now.getTime()) / DAY_MS)
    : null;

  // --- CE in the current/most recent period (half-open, by completed date)
  const startDate = dateOnly(cycleStart);
  const endDate = dateOnly(cycleEnd);
  const approved = credits.filter((c) => c.status === "approved");
  const inPeriod = (c: CeCreditRow) => c.completed_on >= startDate && c.completed_on < endDate;
  const approvedInPeriodRows = approved.filter(inPeriod);
  const pendingInPeriodRows = credits.filter((c) => c.status === "recorded" && inPeriod(c));
  const approvedInPeriod = sumCredits(approvedInPeriodRows);
  const ceMet = approvedInPeriod >= policy.requiredCeCredits;

  const categoryStatus = categories
    .filter((c) => c.active)
    .map((c) => {
      const got = sumCredits(approvedInPeriodRows.filter((r) => r.category === c.key));
      return {
        key: c.key,
        label: c.label,
        approvedInPeriod: got,
        required: c.requiredCreditsPerCycle,
        met: c.requiredCreditsPerCycle === null ? true : got >= c.requiredCreditsPerCycle,
      };
    });
  const mandatoryCategoriesMet = categoryStatus.every((c) => c.met);

  // --- Ethics: once per ethics_interval_months, from the last approved
  // Ethics credit; before any, from the certification date.
  const ethicsKeys = new Set(categories.filter((c) => c.isEthics).map((c) => c.key));
  const ethicsDates = approved.filter((c) => ethicsKeys.has(c.category)).map((c) => c.completed_on).sort();
  const lastEthicsOn = ethicsDates.length ? ethicsDates[ethicsDates.length - 1] : null;
  const ethicsBaseline = lastEthicsOn ? new Date(`${lastEthicsOn}T00:00:00Z`) : certifiedAt;
  const ethicsDueAt = addMonthsUtc(ethicsBaseline, policy.ethicsIntervalMonths);
  const ethicsCurrentNow = now.getTime() < ethicsDueAt.getTime();
  const ethicsMetForRenewal = ethicsDueAt.getTime() > cycleEnd.getTime();
  const ethicsState: CertificationStatus["ethics"]["state"] = !ethicsCurrentNow
    ? "overdue"
    : ethicsMetForRenewal
      ? "current"
      : "due_this_period";

  // --- Inactivity / reactivation window
  const inactiveSince = cert.inactive_since ? new Date(cert.inactive_since) : null;
  let inactivity: CertificationStatus["inactivity"] = null;
  if (cert.standing === "inactive" && inactiveSince) {
    const monthsInactive = wholeMonthsBetween(inactiveSince, now);
    const windowEnds = addMonthsUtc(inactiveSince, policy.reactivationWindowMonths);
    // "More than 24 months": strictly past the 24-month mark, to the instant
    // (24 months and a day inactive is the extended band; exactly 24 is not).
    const band: "standard" | "surcharge" =
      now.getTime() > addMonthsUtc(inactiveSince, policy.reactivationSurchargeAfterMonths).getTime()
        ? "surcharge"
        : "standard";
    inactivity = {
      since: inactiveSince.toISOString(),
      monthsInactive,
      windowEndsAt: windowEnds.toISOString(),
      windowOpen: now.getTime() < windowEnds.getTime(),
      band,
      surchargeCents: policy.reactivationSurchargeCents,
    };
  }

  // --- Payments: unapplied = dated after the last confirmed renewal /
  // reactivation (or after certification if never renewed).
  // Only payments of the right TYPE count: an annual renewal fee paid in a
  // period that then lapsed must not silently stand in as the reactivation
  // fee, and vice versa.
  const appliedThrough = new Date(cert.last_renewed_at ?? cert.certified_at).getTime();
  const feeTypeInPlay: FeePaymentRow["fee_type"] = cert.standing === "inactive" ? "reactivation" : "annual_renewal";
  const paidCents = payments
    .filter((p) => p.fee_type === feeTypeInPlay && new Date(p.paid_at).getTime() > appliedThrough)
    .reduce((acc, p) => acc + p.amount_cents, 0);

  let paymentKind: "annual_renewal" | "reactivation" = "annual_renewal";
  let feeDueCents: number | null = policy.annualRenewalFeeCents;
  if (cert.standing === "inactive") {
    paymentKind = "reactivation";
    if (!inactivity || !inactivity.windowOpen) {
      feeDueCents = null;
    } else if (inactivity.band === "surcharge") {
      feeDueCents = policy.reactivationBaseFeeCents + inactivity.surchargeCents;
    } else {
      feeDueCents = policy.reactivationBaseFeeCents;
    }
  }
  const paymentStatus: CertificationStatus["payment"]["status"] =
    feeDueCents === null ? "not_determined" : paidCents >= feeDueCents ? "paid" : paidCents > 0 ? "partial" : "unpaid";
  const paymentMet = paymentStatus === "paid";

  // --- Renewal requirements (meaningful for an active certification)
  const standingOk = cert.standing === "active";
  const blockers: string[] = [];
  if (!standingOk) blockers.push(`Certification standing is ${cert.standing}, not active.`);
  if (!ceMet) {
    blockers.push(
      `Continuing education: ${approvedInPeriod} of ${policy.requiredCeCredits} approved credits in this period.`
    );
  }
  for (const c of categoryStatus) {
    if (!c.met) {
      blockers.push(`Required category "${c.label}": ${c.approvedInPeriod} of ${c.required} credits.`);
    }
  }
  if (!ethicsMetForRenewal) {
    blockers.push(
      `Ethics course required (due ${formatDateLabel(ethicsDueAt)}); none approved since ${
        lastEthicsOn ? formatDateLabel(`${lastEthicsOn}T00:00:00Z`) : "certification"
      }.`
    );
  }
  if (!paymentMet) {
    blockers.push(
      feeDueCents === null
        ? "Renewal fee cannot be determined."
        : `Renewal fee: ${formatMoney(paidCents)} of ${formatMoney(feeDueCents)} recorded.`
    );
  }
  const allMet = standingOk && ceMet && mandatoryCategoriesMet && ethicsMetForRenewal && paymentMet;

  // --- Reactivation (meaningful for an inactive certification)
  let reactivation: CertificationStatus["reactivation"] = null;
  if (cert.standing === "inactive" && inactivity) {
    const rBlockers: string[] = [];
    if (!inactivity.windowOpen) {
      rBlockers.push(
        `RECERTIFICATION REQUIRED: inactive ${inactivity.monthsInactive} months (window is ${policy.reactivationWindowMonths}). Ordinary reactivation is no longer available; this must go through the AVAIA certification process again.`
      );
    } else {
      if (paymentStatus !== "paid") {
        rBlockers.push(
          feeDueCents === null
            ? "Reactivation fee cannot be determined yet."
            : `Reactivation fee: ${formatMoney(paidCents)} of ${formatMoney(feeDueCents)} recorded.`
        );
      }
      if (!ethicsCurrentNow) {
        rBlockers.push(`Ethics is not current (was due ${formatDateLabel(ethicsDueAt)}); an approved Ethics course is required.`);
      }
    }
    const sinceDate = dateOnly(inactiveSince as Date);
    reactivation = {
      windowOpen: inactivity.windowOpen,
      systemChecksPass: rBlockers.length === 0,
      blockers: rBlockers,
      requiresHumanAttestation: true,
      approvedCeSinceInactive: sumCredits(approved.filter((c) => c.completed_on >= sinceDate)),
    };
  }

  // --- Lifecycle
  let lifecycle: LifecycleState;
  if (cert.standing === "revoked") lifecycle = "revoked";
  else if (cert.standing === "paused") lifecycle = "paused";
  else if (cert.standing === "inactive") {
    lifecycle = inactivity && !inactivity.windowOpen ? "recertification_required" : "inactive_reactivatable";
  } else if (!periodEnded) lifecycle = "active";
  else lifecycle = allMet ? "renewal_ready_awaiting_confirmation" : "lapse_pending";

  return {
    certificationId: cert.id,
    candidateId: cert.candidate_id,
    hostId: cert.host_id,
    standing: cert.standing,
    lifecycle,
    certifiedAt: cert.certified_at,
    cycleStartedAt: cert.cycle_started_at,
    cycleEndsAt: cert.cycle_ends_at,
    inactiveSinceRaw: cert.inactive_since,
    lastRenewedAt: cert.last_renewed_at,
    recertificationRequiredAt: cert.recertification_required_at,
    standingChangedAt: cert.standing_changed_at,
    daysRemaining,
    periodEnded,
    ce: {
      requiredCredits: policy.requiredCeCredits,
      approvedInPeriod,
      pendingInPeriod: sumCredits(pendingInPeriodRows),
      met: ceMet,
      totalApprovedAllTime: sumCredits(approved),
      categories: categoryStatus,
    },
    ethics: {
      lastCompletedOn: lastEthicsOn,
      basis: lastEthicsOn ? "ethics_course" : "certification_date",
      dueAt: ethicsDueAt.toISOString(),
      state: ethicsState,
      metForRenewal: ethicsMetForRenewal,
      currentNow: ethicsCurrentNow,
    },
    payment: { kind: paymentKind, feeDueCents, paidCents, status: paymentStatus },
    renewal: { standingOk, ceMet, mandatoryCategoriesMet, ethicsMet: ethicsMetForRenewal, paymentMet, allMet, blockers },
    inactivity,
    reactivation,
    nextReminderBand:
      cert.standing === "active" && !periodEnded && !allMet
        ? reminderBandFor(daysRemaining, policy.reminderDays)
        : null,
  };
}

/** One-line, human wording for the Ethics state, shared by the Guide's own
 *  status page, the reminder email, and the admin pages so they never
 *  describe the same fact differently. */
export function describeEthics(status: CertificationStatus): string {
  const due = formatDateLabel(status.ethics.dueAt);
  if (status.ethics.state === "current") return `Current (next Ethics course due by ${due})`;
  if (status.ethics.state === "due_this_period") {
    return `An Ethics course is needed before this period ends (due ${due})`;
  }
  return `Overdue: an Ethics course was due ${due}`;
}

export function describePayment(status: CertificationStatus): string {
  const { feeDueCents, paidCents } = status.payment;
  const noun = status.payment.kind === "reactivation" ? "Reactivation fee" : "Renewal fee";
  if (feeDueCents === null) return `${noun} cannot be determined yet`;
  if (status.payment.status === "paid") return `${noun} received (${formatMoney(feeDueCents)})`;
  if (status.payment.status === "partial") {
    return `${formatMoney(paidCents)} of ${formatMoney(feeDueCents)} received`;
  }
  return `Not yet received (${formatMoney(feeDueCents)})`;
}

/** Short Guide-facing label for the lifecycle state. */
export const LIFECYCLE_LABEL: Record<LifecycleState, string> = {
  active: "Active",
  renewal_ready_awaiting_confirmation: "Active — renewal complete, awaiting confirmation",
  lapse_pending: "Renewal period ended — becoming inactive",
  inactive_reactivatable: "Inactive — reactivation available",
  recertification_required: "Inactive — recertification required",
  paused: "Paused",
  revoked: "Revoked",
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

async function buildStatuses(
  supabase: SupabaseClient,
  certs: CertificationRow[],
  now: Date
): Promise<CertificationStatus[]> {
  if (certs.length === 0) return [];
  const ids = certs.map((c) => c.id);
  const [policy, categories, creditsRes, paymentsRes] = await Promise.all([
    loadPolicy(supabase),
    loadCategories(supabase),
    supabase
      .from("guide_ce_credits")
      .select(
        "id, certification_id, host_id, title, provider, category, credits, completed_on, status, program_authorization_key, notes, approved_at, created_at"
      )
      .in("certification_id", ids),
    supabase
      .from("guide_certification_fee_payments")
      .select("id, certification_id, host_id, fee_type, amount_cents, surcharge_cents, paid_at, reference")
      .in("certification_id", ids),
  ]);

  const credits = ((creditsRes.data ?? []) as CeCreditRow[]).map((c) => ({ ...c, credits: Number(c.credits) }));
  const payments = (paymentsRes.data ?? []) as FeePaymentRow[];

  return certs.map((cert) =>
    deriveCertificationStatus({
      cert,
      credits: credits.filter((c) => c.certification_id === cert.id),
      payments: payments.filter((p) => p.certification_id === cert.id),
      policy,
      categories,
      now,
    })
  );
}

/** The certification that represents this Host's current standing: the
 *  active one if any, otherwise the most recently certified. */
export function pickCurrentCertification(certs: CertificationRow[]): CertificationRow | null {
  if (certs.length === 0) return null;
  const active = certs.find((c) => c.standing === "active");
  if (active) return active;
  return [...certs].sort((a, b) => new Date(b.certified_at).getTime() - new Date(a.certified_at).getTime())[0];
}

/** Returns null when the Host has no certification, or when the renewal
 *  tables/columns are not available yet (migration 0082 not applied): the
 *  callers are all display surfaces and must degrade to "nothing to show"
 *  rather than break. */
export async function loadStatusForHost(
  supabase: SupabaseClient,
  hostId: string,
  now: Date = new Date()
): Promise<CertificationStatus | null> {
  const { data, error } = await supabase
    .from("guide_certifications")
    .select(CERTIFICATION_COLUMNS)
    .eq("host_id", hostId);
  if (error || !data) return null;
  const current = pickCurrentCertification(data as CertificationRow[]);
  if (!current) return null;
  const [status] = await buildStatuses(supabase, [current], now);
  return status ?? null;
}

export async function loadStatusForCertification(
  supabase: SupabaseClient,
  certificationId: string,
  now: Date = new Date()
): Promise<CertificationStatus | null> {
  const { data, error } = await supabase
    .from("guide_certifications")
    .select(CERTIFICATION_COLUMNS)
    .eq("id", certificationId)
    .maybeSingle();
  if (error || !data) return null;
  const [status] = await buildStatuses(supabase, [data as CertificationRow], now);
  return status ?? null;
}

export async function loadAllStatuses(supabase: SupabaseClient, now: Date = new Date()): Promise<CertificationStatus[]> {
  const { data, error } = await supabase.from("guide_certifications").select(CERTIFICATION_COLUMNS);
  if (error || !data) return [];
  return buildStatuses(supabase, data as CertificationRow[], now);
}

export async function loadCeCredits(supabase: SupabaseClient, certificationId: string): Promise<CeCreditRow[]> {
  const { data } = await supabase
    .from("guide_ce_credits")
    .select(
      "id, certification_id, host_id, title, provider, category, credits, completed_on, status, program_authorization_key, notes, approved_at, created_at"
    )
    .eq("certification_id", certificationId)
    .order("completed_on", { ascending: false });
  return ((data ?? []) as CeCreditRow[]).map((c) => ({ ...c, credits: Number(c.credits) }));
}

export async function loadFeePayments(supabase: SupabaseClient, certificationId: string): Promise<FeePaymentRow[]> {
  const { data } = await supabase
    .from("guide_certification_fee_payments")
    .select("id, certification_id, host_id, fee_type, amount_cents, surcharge_cents, paid_at, reference")
    .eq("certification_id", certificationId)
    .order("paid_at", { ascending: false });
  return (data ?? []) as FeePaymentRow[];
}

// ---------------------------------------------------------------------------
// Lifecycle audit trail -- reuses guide_candidate_history (entry_type
// 'certification_event', 0022) rather than a second log.
// ---------------------------------------------------------------------------

export async function logCertificationEvent(
  supabase: SupabaseClient,
  candidateId: string,
  body: string,
  recordedBy: string | null
): Promise<void> {
  const { error } = await supabase.from("guide_candidate_history").insert({
    candidate_id: candidateId,
    entry_type: "certification_event",
    body,
    recorded_by: recordedBy,
  });
  if (error) console.error("[certification-renewal] failed to log certification event", error.message);
}

// ---------------------------------------------------------------------------
// Human-performed actions (the admin pages call these after their own
// admin-role check; RLS admin-all on every table is the second gate).
// None of these is ever called from an automation.
// ---------------------------------------------------------------------------

export type ActionResult = { ok: true; message: string } | { ok: false; code: string; message: string };

const fail = (code: string, message: string): ActionResult => ({ ok: false, code, message });

export async function confirmRenewal(
  supabase: SupabaseClient,
  certificationId: string,
  actorId: string,
  now: Date = new Date()
): Promise<ActionResult> {
  const status = await loadStatusForCertification(supabase, certificationId, now);
  if (!status) return fail("not_found", "Certification not found.");
  if (status.standing !== "active") {
    return fail("not_active", "Only an active certification is renewed. An inactive one is reactivated instead.");
  }
  if (!status.cycleEndsAt) return fail("no_cycle", "This certification has no cycle dates yet (apply migration 0082).");
  if (!status.renewal.allMet) {
    return fail("requirements_unmet", `Renewal requirements are not all met. ${status.renewal.blockers.join(" ")}`);
  }

  const policy = await loadPolicy(supabase);
  // Anchored to the prior expiration, so renewing early or late never
  // shifts the Guide's anniversary.
  const newStart = new Date(status.cycleEndsAt);
  const newEnd = addDaysUtc(newStart, policy.cycleDays);

  const { data, error } = await supabase
    .from("guide_certifications")
    .update({
      cycle_started_at: newStart.toISOString(),
      cycle_ends_at: newEnd.toISOString(),
      last_renewed_at: now.toISOString(),
    })
    .eq("id", certificationId)
    .eq("standing", "active")
    .eq("cycle_ends_at", status.cycleEndsAt)
    .select("id");
  if (error) return fail("update_failed", error.message);
  if (!data || data.length === 0) {
    return fail("changed", "This certification changed while you were confirming. Reload and try again.");
  }

  await logCertificationEvent(
    supabase,
    status.candidateId,
    `Renewal confirmed. New 365-day period ${formatDateLabel(newStart)} to ${formatDateLabel(newEnd)}. ` +
      `${status.ce.approvedInPeriod} of ${status.ce.requiredCredits} approved CE credits in the prior period; ` +
      `renewal fee ${formatMoney(status.payment.paidCents)} recorded; Ethics current.`,
    actorId
  );
  return { ok: true, message: `Renewed. New period ends ${formatDateLabel(newEnd)}.` };
}

export async function confirmReactivation(
  supabase: SupabaseClient,
  certificationId: string,
  actorId: string,
  attestation: { attested: boolean; note: string },
  now: Date = new Date()
): Promise<ActionResult> {
  const status = await loadStatusForCertification(supabase, certificationId, now);
  if (!status) return fail("not_found", "Certification not found.");
  if (status.standing !== "inactive" || !status.inactivity || !status.reactivation) {
    return fail("not_inactive", "Only an inactive certification can be reactivated.");
  }
  if (!status.reactivation.windowOpen) {
    return fail(
      "recertification_required",
      "RECERTIFICATION REQUIRED: this certification has been inactive for the full reactivation window. It cannot be reactivated; it must go through the AVAIA certification process again."
    );
  }
  if (!status.reactivation.systemChecksPass) {
    return fail("requirements_unmet", `Reactivation requirements are not met. ${status.reactivation.blockers.join(" ")}`);
  }
  if (!attestation.attested) {
    return fail(
      "attestation_missing",
      "Confirm that you verified good standing and the applicable CE requirement for reactivation."
    );
  }

  const policy = await loadPolicy(supabase);
  const newEnd = addDaysUtc(now, policy.cycleDays);

  const { data, error } = await supabase
    .from("guide_certifications")
    .update({
      standing: "active",
      inactive_since: null,
      recertification_required_at: null,
      standing_changed_at: now.toISOString(),
      standing_changed_by: actorId,
      cycle_started_at: now.toISOString(),
      cycle_ends_at: newEnd.toISOString(),
      last_renewed_at: now.toISOString(),
    })
    .eq("id", certificationId)
    .eq("standing", "inactive")
    .eq("inactive_since", status.inactiveSinceRaw)
    .select("id");
  if (error) return fail("update_failed", error.message);
  if (!data || data.length === 0) {
    return fail("changed", "This certification changed while you were confirming. Reload and try again.");
  }

  await logCertificationEvent(
    supabase,
    status.candidateId,
    `Certification reactivated after ${status.inactivity.monthsInactive} month(s) inactive. New 365-day period ${formatDateLabel(now)} to ${formatDateLabel(newEnd)}. ` +
      `Reactivation fee ${formatMoney(status.payment.paidCents)} recorded; Ethics current. ` +
      `Human attestation recorded: good standing and the applicable reactivation CE requirement verified.` +
      (attestation.note ? ` Note: ${attestation.note}` : ""),
    actorId
  );
  return { ok: true, message: `Reactivated. New period ends ${formatDateLabel(newEnd)}.` };
}

export async function recordCeCredit(
  supabase: SupabaseClient,
  input: {
    certificationId: string;
    title: string;
    provider: string;
    category: string;
    credits: number;
    completedOn: string;
    programAuthorizationKey: string;
    notes: string;
    approveNow: boolean;
  },
  actorId: string,
  now: Date = new Date()
): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return fail("title", "Give the CE record a title.");
  if (!Number.isFinite(input.credits) || input.credits <= 0 || input.credits > 999) {
    return fail("credits", "Credits must be a positive number.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.completedOn) || Number.isNaN(new Date(`${input.completedOn}T00:00:00Z`).getTime())) {
    return fail("date", "Enter the completion date.");
  }
  if (new Date(`${input.completedOn}T00:00:00Z`).getTime() > now.getTime() + DAY_MS) {
    return fail("date", "A completion date cannot be in the future.");
  }
  const categories = await loadCategories(supabase);
  if (!categories.some((c) => c.key === input.category)) return fail("category", "Unknown CE category.");
  const key = input.programAuthorizationKey.trim();
  if (key && !(PROGRAM_AUTHORIZATION_KEYS as readonly string[]).includes(key)) {
    return fail("program_key", "Unknown Program Authorization.");
  }

  const { data: cert } = await supabase
    .from("guide_certifications")
    .select("id, host_id")
    .eq("id", input.certificationId)
    .maybeSingle();
  if (!cert) return fail("not_found", "Certification not found.");

  const { error } = await supabase.from("guide_ce_credits").insert({
    certification_id: cert.id,
    host_id: cert.host_id,
    title,
    provider: input.provider.trim() || null,
    category: input.category,
    credits: input.credits,
    completed_on: input.completedOn,
    program_authorization_key: key || null,
    notes: input.notes.trim() || null,
    status: input.approveNow ? "approved" : "recorded",
    recorded_by: actorId,
    approved_by: input.approveNow ? actorId : null,
    approved_at: input.approveNow ? now.toISOString() : null,
  });
  if (error) return fail("insert_failed", error.message);
  return { ok: true, message: input.approveNow ? "CE credit recorded and approved." : "CE credit recorded, awaiting approval." };
}

export async function setCeCreditStatus(
  supabase: SupabaseClient,
  creditId: string,
  status: "approved" | "rejected",
  actorId: string,
  now: Date = new Date()
): Promise<ActionResult> {
  const { data, error } = await supabase
    .from("guide_ce_credits")
    .update(
      status === "approved"
        ? { status, approved_by: actorId, approved_at: now.toISOString() }
        : { status, approved_by: actorId, approved_at: null }
    )
    .eq("id", creditId)
    .select("id");
  if (error) return fail("update_failed", error.message);
  if (!data || data.length === 0) return fail("not_found", "CE credit not found.");
  return { ok: true, message: status === "approved" ? "CE credit approved." : "CE credit rejected." };
}

export async function recordFeePayment(
  supabase: SupabaseClient,
  input: {
    certificationId: string;
    feeType: string;
    amountDollars: number;
    surchargeDollars: number;
    paidOn: string;
    reference: string;
  },
  actorId: string
): Promise<ActionResult> {
  if (input.feeType !== "annual_renewal" && input.feeType !== "reactivation") {
    return fail("fee_type", "Choose a fee type.");
  }
  if (!Number.isFinite(input.amountDollars) || input.amountDollars < 0 || input.amountDollars > 100_000) {
    return fail("amount", "Enter the amount paid.");
  }
  if (!Number.isFinite(input.surchargeDollars) || input.surchargeDollars < 0) {
    return fail("surcharge", "The surcharge portion must be zero or more.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidOn) || Number.isNaN(new Date(`${input.paidOn}T00:00:00Z`).getTime())) {
    return fail("date", "Enter the payment date.");
  }
  const { data: cert } = await supabase
    .from("guide_certifications")
    .select("id, host_id")
    .eq("id", input.certificationId)
    .maybeSingle();
  if (!cert) return fail("not_found", "Certification not found.");

  const { error } = await supabase.from("guide_certification_fee_payments").insert({
    certification_id: cert.id,
    host_id: cert.host_id,
    fee_type: input.feeType,
    amount_cents: Math.round(input.amountDollars * 100),
    surcharge_cents: Math.round(input.surchargeDollars * 100),
    paid_at: `${input.paidOn}T12:00:00Z`,
    reference: input.reference.trim() || null,
    recorded_by: actorId,
  });
  if (error) return fail("insert_failed", error.message);
  return { ok: true, message: "Payment recorded." };
}
