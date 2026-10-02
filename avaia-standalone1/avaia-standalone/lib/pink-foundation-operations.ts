import "server-only";

/**
 * The Pink Shoelace Foundation Operations + Legacy Control Agent -- typed,
 * deterministic resolver. Audited against the current repository and live
 * schema before writing anything here (see the final report for the full
 * audit). The audit's central findings govern this file's scope:
 *
 *  - pink_contact_submissions, pink_participation_interest,
 *    pink_partnerships, and pink_donor_sponsor_records already existed
 *    (migration 0063) with real RLS (enabled, zero public policies --
 *    service-role only) and a real classifier/email pipeline
 *    (lib/pink/classify.ts, lib/pink/emails.ts), already wired into two
 *    live API routes and already surfaced in the Founder Digest.
 *  - There was no "Legacy" concept anywhere in the schema, no Sponsored
 *    Access tracking, no campaign-review state, no commercial co-venture
 *    tracking, and no volunteer table. This build's migration (0106) adds
 *    exactly those, as pure administrative tracking/routing tables -- no
 *    payment execution, no legal signature capture, no donation processor.
 *  - No payment workflow from the Foundation to AVAIA Institute exists
 *    anywhere in the schema. Per the governing instruction's own
 *    conditional ("if any such payment workflow exists"), nothing is
 *    derived for that here -- see the final report's deferred-items list.
 *  - Donations: pink_donor_sponsor_records remains a structural placeholder
 *    (per docs/PINK_INTEGRATION.md). No donation processor (Give Payments,
 *    Stripe, or otherwise) is connected to it. Stripe exists elsewhere in
 *    this codebase (lib/stripe.ts) but only for AVAIA's own membership
 *    subscriptions -- an entirely separate purpose, not reused or extended
 *    here. This resolver surfaces existing donor/sponsor interest records
 *    for visibility only; it does not model a donation/payment lifecycle.
 *
 * GOVERNING ROLE, enforced here: every function below prepares, collects,
 * organizes, tracks, and flags for review -- never approves a charitable
 * expenditure, never records a signature, and never infers that Legacy
 * approved something. "approved"/"final approval" states are only ever
 * read back from a human-populated field (final_approval_recorded_by,
 * approved_by); this module never sets them and never treats their
 * presence as anything other than a fact someone else recorded.
 *
 * Exception vocabulary reused from every other Operations agent in this
 * codebase (MISSING / WAITING / STALE / MISMATCH / HUMAN_DECISION_REQUIRED
 * / POLICY_REQUIRED) -- see FoundationExceptionCategory. The one addition,
 * COMMERCIAL_CO_VENTURE_REVIEW_REQUIRED, is not a new vocabulary item but
 * the specific routing label the governing instruction (item 7) asks for
 * by name; it is carried as a boolean flag alongside the shared category,
 * never as a seventh category value.
 */

const STALE_DAYS = Number(process.env.PINK_LEGACY_STALE_DAYS ?? 10);

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export const LEGACY_REVIEW_ITEM_TYPES = [
  "sponsored_access",
  "avaia_institute_payment",
  "partnership_agreement",
  "campaign",
  "commercial_co_venture",
  "other",
] as const;
export type LegacyReviewItemType = (typeof LEGACY_REVIEW_ITEM_TYPES)[number];

export const LEGACY_REVIEW_STATES = [
  "draft",
  "ready_for_legacy",
  "submitted_to_legacy",
  "waiting_on_legacy",
  "changes_required",
  "approved",
  "closed",
] as const;
export type LegacyReviewState = (typeof LEGACY_REVIEW_STATES)[number];

export type FoundationExceptionCategory =
  | "MISSING"
  | "WAITING"
  | "STALE"
  | "MISMATCH"
  | "HUMAN_DECISION_REQUIRED"
  | "POLICY_REQUIRED";

export type FoundationException = { category: FoundationExceptionCategory; reason: string };

export type LegacyReviewItemRecord = {
  id: string;
  itemType: LegacyReviewItemType;
  description: string;
  foundationOwner: string | null;
  state: LegacyReviewState;
  submittedAt: string | null;
  requestedResponseDate: string | null;
  legacyResponse: string | null;
  changesRequiredNotes: string | null;
  finalApprovalRecordedBy: string | null;
  finalApprovalRecordedAt: string | null;
  updatedAt: string;
  exception: FoundationException | null;
};

/** Pure derivation for one Legacy Review Queue item. Never infers
 *  "approved" from state alone -- a human-recorded final_approval_recorded_by
 *  is the only thing this reads, and only to report it, not to set it. */
export function deriveLegacyReviewItemException(item: {
  state: LegacyReviewState;
  requestedResponseDate: string | null;
  updatedAt: string;
}): FoundationException | null {
  switch (item.state) {
    case "draft":
    case "ready_for_legacy":
      if (daysSince(item.updatedAt) >= STALE_DAYS) {
        return { category: "STALE", reason: `No activity in ${Math.floor(daysSince(item.updatedAt))} day(s) while still ${item.state}.` };
      }
      return null;
    case "submitted_to_legacy":
    case "waiting_on_legacy":
      if (item.requestedResponseDate && new Date(item.requestedResponseDate).getTime() < Date.now()) {
        return { category: "STALE", reason: "Requested Legacy response date has passed with no recorded response." };
      }
      return { category: "WAITING", reason: "Waiting on Legacy." };
    case "changes_required":
      return { category: "HUMAN_DECISION_REQUIRED", reason: "Legacy requested changes; Foundation owner action needed." };
    case "approved":
    case "closed":
      return null;
  }
}

type RawLegacyReviewItemRow = {
  id: string;
  item_type: LegacyReviewItemType;
  description: string;
  foundation_owner: string | null;
  state: LegacyReviewState;
  submitted_at: string | null;
  requested_response_date: string | null;
  legacy_response: string | null;
  changes_required_notes: string | null;
  final_approval_recorded_by: string | null;
  final_approval_recorded_at: string | null;
  updated_at: string;
};

export function buildLegacyReviewItemRecords(rows: RawLegacyReviewItemRow[]): LegacyReviewItemRecord[] {
  return rows.map((row) => ({
    id: row.id,
    itemType: row.item_type,
    description: row.description,
    foundationOwner: row.foundation_owner,
    state: row.state,
    submittedAt: row.submitted_at,
    requestedResponseDate: row.requested_response_date,
    legacyResponse: row.legacy_response,
    changesRequiredNotes: row.changes_required_notes,
    finalApprovalRecordedBy: row.final_approval_recorded_by,
    finalApprovalRecordedAt: row.final_approval_recorded_at,
    updatedAt: row.updated_at,
    exception: deriveLegacyReviewItemException({
      state: row.state,
      requestedResponseDate: row.requested_response_date,
      updatedAt: row.updated_at,
    }),
  }));
}

// ---------------------------------------------------------------------------
// Sponsored Access (governing instruction item 2). Hard rule enforced here
// structurally: nothing in this module ever treats 'paid_by_legacy' as
// something this system caused -- it is only ever a fact read back from a
// record, the same posture as final_approval_recorded_by above.
// ---------------------------------------------------------------------------

export const SPONSORED_ACCESS_PAYMENT_STATUSES = [
  "not_submitted",
  "submitted_to_legacy",
  "approved_by_legacy",
  "paid_by_legacy",
  "declined_by_legacy",
] as const;
export type SponsoredAccessPaymentStatus = (typeof SPONSORED_ACCESS_PAYMENT_STATUSES)[number];

export type SponsoredAccessRecord = {
  id: string;
  charitablePurpose: string;
  providerOrganization: string;
  invoiceReference: string | null;
  w9OnFile: boolean;
  paymentInstructionsReference: string | null;
  packetComplete: boolean;
  legacyReviewItemId: string | null;
  paymentStatus: SponsoredAccessPaymentStatus;
  exception: FoundationException | null;
};

export function deriveSponsoredAccessPacketComplete(req: {
  charitablePurpose: string;
  providerOrganization: string;
  invoiceReference: string | null;
  w9OnFile: boolean;
  paymentInstructionsReference: string | null;
}): boolean {
  return Boolean(
    req.charitablePurpose && req.providerOrganization && req.invoiceReference && req.w9OnFile && req.paymentInstructionsReference
  );
}

export function deriveSponsoredAccessException(req: {
  packetComplete: boolean;
  legacyReviewItemId: string | null;
  paymentStatus: SponsoredAccessPaymentStatus;
}): FoundationException | null {
  if (!req.packetComplete) return { category: "MISSING", reason: "Sponsored Access packet is incomplete." };
  switch (req.paymentStatus) {
    case "not_submitted":
      return { category: "HUMAN_DECISION_REQUIRED", reason: "Packet complete; ready to route to Legacy." };
    case "submitted_to_legacy":
    case "approved_by_legacy":
      return { category: "WAITING", reason: "Waiting on Legacy." };
    case "declined_by_legacy":
      return { category: "HUMAN_DECISION_REQUIRED", reason: "Legacy declined this request; Foundation owner action needed." };
    case "paid_by_legacy":
      return null;
  }
}

type RawSponsoredAccessRow = {
  id: string;
  charitable_purpose: string;
  provider_organization: string;
  invoice_reference: string | null;
  w9_on_file: boolean;
  payment_instructions_reference: string | null;
  legacy_review_item_id: string | null;
  payment_status: SponsoredAccessPaymentStatus;
};

export function buildSponsoredAccessRecords(rows: RawSponsoredAccessRow[]): SponsoredAccessRecord[] {
  return rows.map((row) => {
    const packetComplete = deriveSponsoredAccessPacketComplete({
      charitablePurpose: row.charitable_purpose,
      providerOrganization: row.provider_organization,
      invoiceReference: row.invoice_reference,
      w9OnFile: row.w9_on_file,
      paymentInstructionsReference: row.payment_instructions_reference,
    });
    return {
      id: row.id,
      charitablePurpose: row.charitable_purpose,
      providerOrganization: row.provider_organization,
      invoiceReference: row.invoice_reference,
      w9OnFile: row.w9_on_file,
      paymentInstructionsReference: row.payment_instructions_reference,
      packetComplete,
      legacyReviewItemId: row.legacy_review_item_id,
      paymentStatus: row.payment_status,
      exception: deriveSponsoredAccessException({ packetComplete, legacyReviewItemId: row.legacy_review_item_id, paymentStatus: row.payment_status }),
    };
  });
}

// ---------------------------------------------------------------------------
// Campaign Review (item 5). Never infers approved_for_publication from
// submission -- only the stored state (set exclusively by a human via
// approved_by/approved_at) is read.
// ---------------------------------------------------------------------------

export type CampaignItemRecord = {
  id: string;
  title: string;
  state: "draft" | "approved_for_publication";
  legacyReviewItemId: string | null;
  approvedBy: string | null;
  exception: FoundationException | null;
};

export function deriveCampaignItemException(item: {
  state: "draft" | "approved_for_publication";
  approvedBy: string | null;
  updatedAt: string;
}): FoundationException | null {
  if (item.state === "approved_for_publication") {
    // Structural defense only -- the app never sets this state without
    // approved_by, so this should be unreachable in practice.
    if (!item.approvedBy) return { category: "MISMATCH", reason: "Marked approved_for_publication with no recorded approver." };
    return null;
  }
  if (daysSince(item.updatedAt) >= STALE_DAYS) {
    return { category: "STALE", reason: `Campaign draft has had no activity in ${Math.floor(daysSince(item.updatedAt))} day(s).` };
  }
  return null;
}

type RawCampaignItemRow = {
  id: string;
  title: string;
  state: "draft" | "approved_for_publication";
  legacy_review_item_id: string | null;
  approved_by: string | null;
  updated_at: string;
};

export function buildCampaignItemRecords(rows: RawCampaignItemRow[]): CampaignItemRecord[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    state: row.state,
    legacyReviewItemId: row.legacy_review_item_id,
    approvedBy: row.approved_by,
    exception: deriveCampaignItemException({ state: row.state, approvedBy: row.approved_by, updatedAt: row.updated_at }),
  }));
}

// ---------------------------------------------------------------------------
// Commercial Co-Venture (item 7). Every row is a review trigger by
// construction -- the only thing that can clear it is the linked Legacy
// Review item reaching 'approved' or 'closed'.
// ---------------------------------------------------------------------------

export type CommercialCoVentureRecord = {
  id: string;
  proposedPartner: string;
  legacyReviewItemId: string | null;
  reviewRequired: boolean;
  label: "COMMERCIAL_CO_VENTURE_REVIEW_REQUIRED" | null;
};

export function buildCommercialCoVentureRecords(
  rows: { id: string; proposed_partner: string; legacy_review_item_id: string | null }[],
  legacyItemsById: Map<string, { state: LegacyReviewState }>
): CommercialCoVentureRecord[] {
  return rows.map((row) => {
    const linked = row.legacy_review_item_id ? legacyItemsById.get(row.legacy_review_item_id) : undefined;
    const cleared = linked ? linked.state === "approved" || linked.state === "closed" : false;
    return {
      id: row.id,
      proposedPartner: row.proposed_partner,
      legacyReviewItemId: row.legacy_review_item_id,
      reviewRequired: !cleared,
      label: cleared ? null : "COMMERCIAL_CO_VENTURE_REVIEW_REQUIRED",
    };
  });
}

// ---------------------------------------------------------------------------
// Community Connection Volunteers (item 8). safety_review_state is never
// set by this module -- it only reads and surfaces what a human (or the
// intake path) already recorded. No universal insurance/waiver/background-
// check requirement is invented anywhere here.
// ---------------------------------------------------------------------------

export const VOLUNTEER_SAFETY_REVIEW_STATES = ["not_flagged", "human_review_recommended", "legacy_review_recommended"] as const;
export type VolunteerSafetyReviewState = (typeof VOLUNTEER_SAFETY_REVIEW_STATES)[number];

export type VolunteerRecord = {
  id: string;
  name: string;
  onboardingStatus: "inquiry" | "onboarding" | "active" | "inactive";
  safetyReviewState: VolunteerSafetyReviewState;
  exception: FoundationException | null;
};

export function deriveVolunteerException(v: { safetyReviewState: VolunteerSafetyReviewState }): FoundationException | null {
  if (v.safetyReviewState === "legacy_review_recommended") return { category: "POLICY_REQUIRED", reason: "Legacy review recommended for this volunteer activity." };
  if (v.safetyReviewState === "human_review_recommended") return { category: "HUMAN_DECISION_REQUIRED", reason: "Human review recommended for this volunteer activity." };
  return null;
}

type RawVolunteerRow = {
  id: string;
  name: string;
  onboarding_status: "inquiry" | "onboarding" | "active" | "inactive";
  safety_review_state: VolunteerSafetyReviewState;
};

export function buildVolunteerRecords(rows: RawVolunteerRow[]): VolunteerRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    onboardingStatus: row.onboarding_status,
    safetyReviewState: row.safety_review_state,
    exception: deriveVolunteerException({ safetyReviewState: row.safety_review_state }),
  }));
}

// ---------------------------------------------------------------------------
// Partnerships (item 4) -- pink_partnerships already existed (0063); this
// module only derives an exception view over it, reusing its real fields
// rather than re-modeling the table.
// ---------------------------------------------------------------------------

export type PartnershipExceptionRecord = {
  id: string;
  organizationName: string;
  stage: "inquiry" | "in_conversation" | "active" | "paused" | "closed";
  legacyReviewItemId: string | null;
  dorianActionNeeded: boolean;
  nextFollowUpAt: string | null;
  exception: FoundationException | null;
};

export function derivePartnershipException(p: {
  stage: "inquiry" | "in_conversation" | "active" | "paused" | "closed";
  dorianActionNeeded: boolean;
  nextFollowUpAt: string | null;
}): FoundationException | null {
  if (p.dorianActionNeeded) return { category: "HUMAN_DECISION_REQUIRED", reason: "Flagged for Dorian's action." };
  if (p.nextFollowUpAt && new Date(p.nextFollowUpAt).getTime() < Date.now()) {
    return { category: "WAITING", reason: "Follow-up is due." };
  }
  return null;
}

type RawPartnershipRow = {
  id: string;
  organization_name: string;
  stage: "inquiry" | "in_conversation" | "active" | "paused" | "closed";
  legacy_review_item_id: string | null;
  dorian_action_needed: boolean;
  next_follow_up_at: string | null;
};

export function buildPartnershipExceptionRecords(rows: RawPartnershipRow[]): PartnershipExceptionRecord[] {
  return rows.map((row) => ({
    id: row.id,
    organizationName: row.organization_name,
    stage: row.stage,
    legacyReviewItemId: row.legacy_review_item_id,
    dorianActionNeeded: row.dorian_action_needed,
    nextFollowUpAt: row.next_follow_up_at,
    exception: derivePartnershipException({ stage: row.stage, dorianActionNeeded: row.dorian_action_needed, nextFollowUpAt: row.next_follow_up_at }),
  }));
}
