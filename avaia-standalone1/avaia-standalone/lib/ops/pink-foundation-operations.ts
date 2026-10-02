import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildLegacyReviewItemRecords,
  buildSponsoredAccessRecords,
  buildCampaignItemRecords,
  buildCommercialCoVentureRecords,
  buildVolunteerRecords,
  buildPartnershipExceptionRecords,
  type LegacyReviewItemRecord,
  type SponsoredAccessRecord,
  type CampaignItemRecord,
  type CommercialCoVentureRecord,
  type VolunteerRecord,
  type PartnershipExceptionRecord,
  type LegacyReviewState,
} from "@/lib/pink-foundation-operations";

// The Pink Shoelace Foundation Operations + Legacy Control Agent -- admin-
// client batched fetch, mirroring every other Operations agent's I/O layer
// in this codebase (lib/ops/guide-access-operations.ts,
// lib/ops/organization-operations.ts). Pure derivation lives in
// lib/pink-foundation-operations.ts; this file only reads/writes.
//
// REMINDER_COOLDOWN_DAYS and the reminder sender below reuse the exact
// idempotency pattern already established for host onboarding and guide
// candidates (lib/ops/host-onboarding.ts, pink_foundation_reminders ==
// host_onboarding_reminders' shape). Every reminder this module sends goes
// to the Foundation's own internal notification address
// (PINK_NOTIFICATION_EMAIL / CONTACT_NOTIFICATION_EMAIL) -- never to Legacy
// Global Programs directly. The governing instruction is explicit: "Do not
// automatically contact Legacy until the existing email/workflow
// architecture and recipient information are verified." No Legacy contact
// has been verified in this codebase, so this agent never emails Legacy;
// it only ever tells Dorian/the Foundation owner that something is ready
// to send to Legacy, or that Legacy's response is overdue.

const REMINDER_COOLDOWN_DAYS = Number(process.env.PINK_FOUNDATION_REMINDER_COOLDOWN_DAYS ?? 7);

export async function getAllLegacyReviewItems(): Promise<LegacyReviewItemRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pink_legacy_review_items")
    .select(
      "id, item_type, description, foundation_owner, state, submitted_at, requested_response_date, legacy_response, changes_required_notes, final_approval_recorded_by, final_approval_recorded_at, updated_at"
    )
    .order("updated_at", { ascending: true });
  return buildLegacyReviewItemRecords(data ?? []);
}

export async function getAllSponsoredAccessRequests(): Promise<SponsoredAccessRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pink_sponsored_access_requests")
    .select(
      "id, charitable_purpose, provider_organization, invoice_reference, w9_on_file, payment_instructions_reference, legacy_review_item_id, payment_status"
    )
    .order("created_at", { ascending: true });
  return buildSponsoredAccessRecords(data ?? []);
}

export async function getAllCampaignItems(): Promise<CampaignItemRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pink_campaign_items")
    .select("id, title, state, legacy_review_item_id, approved_by, updated_at")
    .order("updated_at", { ascending: true });
  return buildCampaignItemRecords(data ?? []);
}

export async function getAllCommercialCoVentures(): Promise<CommercialCoVentureRecord[]> {
  const admin = createAdminClient();
  const [{ data: ventureRows }, { data: legacyRows }] = await Promise.all([
    admin.from("pink_commercial_co_ventures").select("id, proposed_partner, legacy_review_item_id"),
    admin.from("pink_legacy_review_items").select("id, state"),
  ]);
  const legacyItemsById = new Map(
    ((legacyRows ?? []) as { id: string; state: LegacyReviewState }[]).map((r) => [r.id, { state: r.state }])
  );
  return buildCommercialCoVentureRecords(ventureRows ?? [], legacyItemsById);
}

export async function getAllVolunteers(): Promise<VolunteerRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("pink_volunteers").select("id, name, onboarding_status, safety_review_state");
  return buildVolunteerRecords(data ?? []);
}

export async function getAllPartnershipExceptions(): Promise<PartnershipExceptionRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("pink_partnerships")
    .select("id, organization_name, stage, legacy_review_item_id, dorian_action_needed, next_follow_up_at")
    .order("next_follow_up_at", { ascending: true });
  return buildPartnershipExceptionRecords(data ?? []);
}

/** Visibility only -- pink_donor_sponsor_records remains a structural
 *  placeholder (see docs/PINK_INTEGRATION.md and this module's resolver
 *  header). No processor is connected, so this never models a donation
 *  lifecycle; it just surfaces what's on file. */
export async function getDonorSponsorRecordsForDisplay(): Promise<
  { id: string; donorName: string; donorType: string | null; status: string }[]
> {
  const admin = createAdminClient();
  const { data } = await admin.from("pink_donor_sponsor_records").select("id, donor_name, donor_type, status");
  return (data ?? []).map((r: { id: string; donor_name: string; donor_type: string | null; status: string }) => ({
    id: r.id,
    donorName: r.donor_name,
    donorType: r.donor_type,
    status: r.status,
  }));
}

export type PinkFoundationOperationsSummary = {
  legacyReviewWaiting: number;
  legacyReviewOverdue: number;
  legacyReviewChangesRequired: number;
  sponsoredAccessIncomplete: number;
  sponsoredAccessReadyToSubmit: number;
  partnershipsDue: number;
  campaignDraftsStale: number;
  commercialCoVenturesNeedingReview: number;
  volunteerSafetyReviews: number;
};

export async function getPinkFoundationOperationsSummary(): Promise<{
  summary: PinkFoundationOperationsSummary;
  legacyReviewItems: LegacyReviewItemRecord[];
  sponsoredAccess: SponsoredAccessRecord[];
  campaignItems: CampaignItemRecord[];
  commercialCoVentures: CommercialCoVentureRecord[];
  volunteers: VolunteerRecord[];
  partnerships: PartnershipExceptionRecord[];
}> {
  const [legacyReviewItems, sponsoredAccess, campaignItems, commercialCoVentures, volunteers, partnerships] =
    await Promise.all([
      getAllLegacyReviewItems(),
      getAllSponsoredAccessRequests(),
      getAllCampaignItems(),
      getAllCommercialCoVentures(),
      getAllVolunteers(),
      getAllPartnershipExceptions(),
    ]);

  const summary: PinkFoundationOperationsSummary = {
    legacyReviewWaiting: legacyReviewItems.filter((i) => i.exception?.category === "WAITING").length,
    legacyReviewOverdue: legacyReviewItems.filter((i) => i.exception?.category === "STALE").length,
    legacyReviewChangesRequired: legacyReviewItems.filter((i) => i.state === "changes_required").length,
    sponsoredAccessIncomplete: sponsoredAccess.filter((r) => r.exception?.category === "MISSING").length,
    sponsoredAccessReadyToSubmit: sponsoredAccess.filter(
      (r) => r.packetComplete && r.paymentStatus === "not_submitted"
    ).length,
    partnershipsDue: partnerships.filter((p) => p.exception?.category === "WAITING").length,
    campaignDraftsStale: campaignItems.filter((c) => c.exception?.category === "STALE").length,
    commercialCoVenturesNeedingReview: commercialCoVentures.filter((c) => c.reviewRequired).length,
    volunteerSafetyReviews: volunteers.filter((v) => v.exception !== null).length,
  };

  return { summary, legacyReviewItems, sponsoredAccess, campaignItems, commercialCoVentures, volunteers, partnerships };
}

type ReminderType =
  | "legacy_review_reminder"
  | "incomplete_document_reminder"
  | "partnership_follow_up_reminder"
  | "overdue_legacy_response_flag";

async function withinCooldown(
  admin: ReturnType<typeof createAdminClient>,
  entityType: string,
  entityId: string,
  reminderType: ReminderType
): Promise<boolean> {
  const { data: lastReminder } = await admin
    .from("pink_foundation_reminders")
    .select("sent_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("reminder_type", reminderType)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastReminder) return false;
  const daysSince = (Date.now() - new Date(lastReminder.sent_at).getTime()) / 86_400_000;
  return daysSince < REMINDER_COOLDOWN_DAYS;
}

/** Sends at most one reminder per entity per reminder type per cooldown
 *  window, same posture as sendStalledOnboardingReminders. sendFn is
 *  always an internal notification (to the Foundation's own notification
 *  address) -- never a message to Legacy. Returns counts for the cron
 *  route and Founder Digest; failures are best-effort/logged, matching
 *  every other email send in this codebase (no persisted retry queue
 *  exists anywhere in this repo -- see the final report's audit of
 *  "failed-email retry"). */
export async function sendFoundationReminders(
  sendFn: (args: {
    entityType: string;
    entityId: string;
    reminderType: ReminderType;
    category: string;
    reason: string;
    description: string;
  }) => Promise<void>
): Promise<{ sent: number; skippedCooldown: number; failed: number }> {
  const admin = createAdminClient();
  let sent = 0;
  let skippedCooldown = 0;
  let failed = 0;

  const { legacyReviewItems, sponsoredAccess, partnerships } = await getPinkFoundationOperationsSummary();

  const candidates: {
    entityType: string;
    entityId: string;
    reminderType: ReminderType;
    category: string;
    reason: string;
    description: string;
  }[] = [];

  for (const item of legacyReviewItems) {
    if (item.exception?.category === "STALE" && (item.state === "submitted_to_legacy" || item.state === "waiting_on_legacy")) {
      candidates.push({
        entityType: "legacy_review_item",
        entityId: item.id,
        reminderType: "overdue_legacy_response_flag",
        category: item.exception.category,
        reason: item.exception.reason,
        description: item.description,
      });
    } else if (item.exception?.category === "WAITING") {
      candidates.push({
        entityType: "legacy_review_item",
        entityId: item.id,
        reminderType: "legacy_review_reminder",
        category: item.exception.category,
        reason: item.exception.reason,
        description: item.description,
      });
    }
  }

  for (const req of sponsoredAccess) {
    if (req.exception?.category === "MISSING") {
      candidates.push({
        entityType: "sponsored_access_request",
        entityId: req.id,
        reminderType: "incomplete_document_reminder",
        category: req.exception.category,
        reason: req.exception.reason,
        description: `${req.charitablePurpose} -- ${req.providerOrganization}`,
      });
    }
  }

  for (const p of partnerships) {
    if (p.exception?.category === "WAITING") {
      candidates.push({
        entityType: "partnership",
        entityId: p.id,
        reminderType: "partnership_follow_up_reminder",
        category: p.exception.category,
        reason: p.exception.reason,
        description: p.organizationName,
      });
    }
  }

  for (const c of candidates) {
    if (await withinCooldown(admin, c.entityType, c.entityId, c.reminderType)) {
      skippedCooldown += 1;
      continue;
    }
    try {
      await sendFn(c);
      await admin.from("pink_foundation_reminders").insert({
        entity_type: c.entityType,
        entity_id: c.entityId,
        reminder_type: c.reminderType,
      });
      sent += 1;
    } catch (e) {
      console.error(`Pink Foundation reminder failed (${c.reminderType} for ${c.entityType} ${c.entityId}):`, e);
      failed += 1;
    }
  }

  return { sent, skippedCooldown, failed };
}
