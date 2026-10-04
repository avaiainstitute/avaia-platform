// CERTIFICATION ADMISSIONS: the front door of Guide certification, as pure rules.
//
// Two gates, never one (Decision 0004):
//     Admission decision      -> Candidate
//     Certification decision  -> AVAIA Certified Guide
// Admission is NOT a promise of certification. Everything in this file is about
// Gate 1 only. Nothing here evaluates, scores or certifies anyone.
//
// The sequence: application (no fee) + a saved payment method (no charge) ->
// human review -> human admission decision -> only if admitted, the $1,495 is
// charged once. A person who is not admitted is never charged and their saved
// method is removed. A failed charge never revokes an admission.

/** The standard AVAIA Certification payment (Decision 0002), charged only after
 *  a human admission decision. A constant, in cents. */
export const ADMISSION_AMOUNT_CENTS = 149_500;
export const ADMISSION_AMOUNT_LABEL = "$1,495";

export const APPLICATION_STATUSES = ["pending_payment_method", "ready_for_review", "admitted", "not_admitted"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const CHARGE_STATUSES = ["not_charged", "charging", "charged", "failed", "not_applicable"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const PATHWAYS = ["core_certification", "other_permission"] as const;
export type Pathway = (typeof PATHWAYS)[number];

export const PATHWAY_LABEL: Record<Pathway, string> = {
  core_certification: "Core Guide certification",
  other_permission: "Another permission",
};

export type ApplicationInput = {
  fullName: string;
  contact: string;
  whyInterested: string;
  workContext: string;
  howUseAvaia: string;
  pathway: string;
  pathwayNote: string;
  orientationAgreed: boolean;
};

export type ValidApplication = {
  fullName: string;
  contact: string;
  whyInterested: string;
  workContext: string;
  howUseAvaia: string;
  pathway: Pathway;
  pathwayNote: string | null;
  orientationAgreed: true;
};

const MAX_FIELD = 4000;

/** Prospectus v0.1 fields, nothing more ("do not overbuild the application"). */
export function validateApplication(input: ApplicationInput): { ok: true; value: ValidApplication } | { ok: false; code: string; error: string } {
  const fullName = input.fullName.trim();
  const contact = input.contact.trim();
  const whyInterested = input.whyInterested.trim();
  const workContext = input.workContext.trim();
  const howUseAvaia = input.howUseAvaia.trim();
  const pathwayNote = input.pathwayNote.trim();
  if (!fullName) return { ok: false, code: "name", error: "Please tell us your name." };
  if (!contact) return { ok: false, code: "contact", error: "Please tell us how to reach you (email or phone)." };
  if (!whyInterested) return { ok: false, code: "why", error: "Please tell us why you are interested." };
  if (!workContext) return { ok: false, code: "work", error: "Please describe the work or community you do." };
  if (!howUseAvaia) return { ok: false, code: "how", error: "Please tell us how you imagine using AVAIA." };
  if (!(PATHWAYS as readonly string[]).includes(input.pathway)) return { ok: false, code: "pathway", error: "Please choose whether this is core Guide certification or another permission." };
  if (!input.orientationAgreed) return { ok: false, code: "orientation", error: "Please agree to receive orientation so we can reach you about next steps." };
  for (const v of [fullName, contact, whyInterested, workContext, howUseAvaia, pathwayNote]) {
    if (v.length > MAX_FIELD) return { ok: false, code: "long", error: "One of your answers is too long. Please shorten it." };
  }
  return {
    ok: true,
    value: {
      fullName,
      contact,
      whyInterested,
      workContext,
      howUseAvaia,
      pathway: input.pathway as Pathway,
      pathwayNote: pathwayNote || null,
      orientationAgreed: true,
    },
  };
}

export type ApplicationRecord = {
  id: string;
  hostId: string;
  status: ApplicationStatus;
  chargeStatus: ChargeStatus;
  chargeFailure: string | null;
  denialHandled: boolean;
  submittedAt: string;
  paymentMethodSavedAt: string | null;
  decidedAt: string | null;
  updatedAt: string;
  /** True when this person has an earlier application that was not admitted
   *  (shown to the reviewer; reapplication policy is not decided). */
  previouslyNotAdmitted: boolean;
};

export type ApplicationItem = { key: string; text: string; href: string };

/** Days a started application may sit without a saved payment method before it
 *  is worth a glance (visibility only: nothing is due from anyone). */
export const INCOMPLETE_APPLICATION_DAYS = 7;

/** A charge attempt that has been "in progress" this long probably never
 *  finished; it is surfaced, never retried automatically (double-charge guard). */
export const STUCK_CHARGE_MINUTES = 60;

export type ApplicationClassification = {
  decisions: ApplicationItem[];
  problems: ApplicationItem[];
  policy: ApplicationItem[];
  watching: ApplicationItem[];
};

/** What needs a person, from application records alone. One item per root cause.
 *   - ready_for_review            -> a human admission decision is due.
 *   - admitted + charge failed    -> a problem to retry (admission is never revoked).
 *   - not_admitted, not handled   -> denial handling is undefined: surfaced, not invented.
 *   - started but no card saved   -> visibility only. */
export function classifyApplications(records: ApplicationRecord[], label: (hostId: string) => string, now = Date.now()): ApplicationClassification {
  const out: ApplicationClassification = { decisions: [], problems: [], policy: [], watching: [] };
  const href = "/admin/certification-applications";
  for (const r of records) {
    const who = label(r.hostId);
    if (r.status === "ready_for_review") {
      out.decisions.push({
        key: `application:${r.id}:review`,
        href,
        text: `${who}: certification application is ready for your admission decision${r.previouslyNotAdmitted ? " (this person was not admitted on an earlier application)" : ""}. Admission makes them a Candidate, not a Certified Guide. Nothing is charged until you admit.`,
      });
    } else if (r.status === "admitted" && r.chargeStatus === "charging") {
      const ageMinutes = (now - new Date(r.updatedAt).getTime()) / 60_000;
      if (ageMinutes >= STUCK_CHARGE_MINUTES) {
        out.problems.push({
          key: `application:${r.id}:charge`,
          href,
          text: `${who}: admitted. A ${ADMISSION_AMOUNT_LABEL} charge attempt started ${Math.floor(ageMinutes)} minutes ago and never finished. Check Stripe before retrying so they are not charged twice. The admission stands.`,
        });
      }
    } else if (r.status === "admitted" && (r.chargeStatus === "failed" || r.chargeStatus === "not_charged")) {
      out.problems.push({
        key: `application:${r.id}:charge`,
        href,
        text: `${who}: admitted, but the ${ADMISSION_AMOUNT_LABEL} charge has not succeeded${r.chargeFailure ? ` (${r.chargeFailure})` : ""}. The admission stands; retry the charge or contact them.`,
      });
    } else if (r.status === "not_admitted" && !r.denialHandled) {
      out.policy.push({
        key: `application:${r.id}:denial_handling`,
        href,
        text: `${who}: not admitted. Denial handling (what they are told, reapplication, any refund) is not yet decided. They were not charged and their saved payment method was removed. Mark handled once you have dealt with it.`,
      });
    } else if (r.status === "pending_payment_method") {
      const ageDays = (now - new Date(r.submittedAt).getTime()) / 86_400_000;
      if (ageDays >= INCOMPLETE_APPLICATION_DAYS) {
        out.watching.push({
          key: `application:${r.id}:no_payment_method`,
          href,
          text: `${who}: started a certification application ${Math.floor(ageDays)} day(s) ago but has not saved a payment method yet. Nothing is waiting on you.`,
        });
      }
    }
  }
  return out;
}

/** A charge attempt may begin only for an admitted application whose charge is
 *  not already done or in flight. This is the double-charge guard. */
export function mayAttemptCharge(status: ApplicationStatus, charge: ChargeStatus): boolean {
  return status === "admitted" && (charge === "not_charged" || charge === "failed");
}

/** The idempotency key for one charge attempt: stable per application and attempt
 *  number, so a retried request after a network failure cannot double-charge, while
 *  a deliberate retry after a decline uses a new attempt number. */
export function chargeIdempotencyKey(applicationId: string, attemptNumber: number): string {
  return `certification-admission-${applicationId}-${attemptNumber}`;
}

/** Candidate statuses under which the classroom (and candidacy access) is open.
 *  Paused and hold close it for now, the same rule the classroom itself applies. */
export const ACTIVE_CANDIDACY_STATUSES = ["admitted", "in_training", "development_required"] as const;

/** Candidacy gives the AVAIA access needed to certify, and ends with candidacy.
 *  It is tied to an active candidacy that has not yet become a certification:
 *  a certified Guide's access follows certification and Toolkit authorization,
 *  not candidacy. A candidate who already has a membership keeps it untouched
 *  (candidacy access is a separate row with its own source, only ever created
 *  for someone with no active entitlement). */
export function shouldHoldCandidacyAccess(candidateStatus: string | null, hasCertification: boolean): boolean {
  if (hasCertification) return false;
  return !!candidateStatus && (ACTIVE_CANDIDACY_STATUSES as readonly string[]).includes(candidateStatus);
}

export type AccessMismatch = { kind: "missing" | "stale"; hostId: string };

/** Pure integrity check of candidacy access: every person who should hold it
 *  does (unless they already have some other active entitlement, which is left
 *  untouched), and no 'candidacy' access outlives its candidacy. */
export function candidacyAccessMismatches(args: {
  candidates: { host_id: string; status: string }[];
  certifiedHostIds: Set<string>;
  activeEntitlements: { host_id: string; source: string }[];
}): AccessMismatch[] {
  const hasAny = new Set<string>();
  const hasCandidacy = new Set<string>();
  for (const e of args.activeEntitlements) {
    hasAny.add(e.host_id);
    if (e.source === "candidacy") hasCandidacy.add(e.host_id);
  }
  const holders = new Set<string>();
  for (const c of args.candidates) {
    if (shouldHoldCandidacyAccess(c.status, args.certifiedHostIds.has(c.host_id))) holders.add(c.host_id);
  }
  const out: AccessMismatch[] = [];
  for (const hostId of holders) if (!hasAny.has(hostId)) out.push({ kind: "missing", hostId });
  for (const hostId of hasCandidacy) if (!holders.has(hostId)) out.push({ kind: "stale", hostId });
  return out;
}
