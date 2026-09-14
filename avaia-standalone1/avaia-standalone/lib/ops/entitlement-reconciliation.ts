import "server-only";
import type Stripe from "stripe";
import { stripe, REVOKING_SUBSCRIPTION_STATUSES } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeIndividualEntitlement } from "@/lib/membership";
import { cancelFamilyMembership } from "@/lib/family-membership";

// Automation audit finding #2.4 (Stripe <-> entitlements reconciliation).
// Stripe is the source of truth for payment/subscription state; this job
// never invents access or pricing rules of its own, it only compares
// Stripe's own subscription status against AVAIA's local `entitlements`/
// `family_memberships` tables and reacts using the exact same rules the
// Stripe webhook itself already applies live (REVOKING_SUBSCRIPTION_
// STATUSES, revokeIndividualEntitlement, cancelFamilyMembership -- all
// imported, none reimplemented here).
//
// The two directions are treated asymmetrically, deliberately:
// - Stripe says the subscription has ended, but local access is still
//   active: SAFE TO AUTO-CORRECT. This is exactly what the webhook would
//   already have done had its event been delivered; reconciliation is only
//   catching up on a possibly-missed webhook, using the same idempotent
//   revoke functions, so running this job twice never double-revokes.
// - Stripe says the subscription is active, but no local entitlement
//   exists: SURFACED ONLY, never auto-granted. Granting access carries
//   more risk than revoking incorrectly-retained access (a wrong grant
//   gives away real product access; a wrong revoke is caught the moment
//   the Host notices and is trivially reversible) -- per the standing
//   instruction not to blindly modify entitlement state, this direction
//   always goes to "What Needs Dorian" for a human look, never an
//   automatic insert.

export type ReconciliationFinding = {
  type: "stripe_active_no_local_entitlement" | "local_active_stripe_ended";
  hostId: string;
  stripeSubscriptionId: string;
  stripeStatus: string;
  tier: "individual" | "family";
  corrected: boolean;
  correctionError?: string;
};

async function hasActiveIndividualEntitlement(admin: ReturnType<typeof createAdminClient>, hostId: string): Promise<boolean> {
  const { data } = await admin
    .from("entitlements")
    .select("id")
    .eq("host_id", hostId)
    .eq("status", "active")
    .eq("source", "individual")
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function hasActiveFamilyMembership(
  admin: ReturnType<typeof createAdminClient>,
  stripeSubscriptionId: string
): Promise<boolean> {
  const { data } = await admin
    .from("family_memberships")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Lists up to 1000 of the most recent Stripe subscriptions (10 pages of
 *  100, the same page-capped pagination idiom already used elsewhere in
 *  this codebase, e.g. app/admin/guide-candidates/page.tsx's
 *  findHostIdByEmail). A business with more than 1000 total subscriptions
 *  ever created would need a wider cap -- flagged here rather than
 *  silently truncated forever. */
async function listRecentSubscriptions(): Promise<Stripe.Subscription[]> {
  const client = stripe();
  const subscriptions: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await client.subscriptions.list({ limit: 100, starting_after: startingAfter });
    subscriptions.push(...res.data);
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
  }
  return subscriptions;
}

export async function runEntitlementReconciliation(): Promise<{
  findings: ReconciliationFinding[];
  correctedCount: number;
  surfacedCount: number;
  subscriptionsChecked: number;
}> {
  const admin = createAdminClient();
  const subscriptions = await listRecentSubscriptions();

  // Only ever consider subscriptions carrying AVAIA's own identifying
  // metadata (set at checkout, see app/api/stripe/checkout/route.ts) --
  // never assume every subscription on this Stripe account is AVAIA's.
  const avaiaSubs = subscriptions.filter((s) => !!s.metadata?.supabase_user_id);

  const findings: ReconciliationFinding[] = [];

  for (const sub of avaiaSubs) {
    const hostId = sub.metadata.supabase_user_id as string;
    const tier: "individual" | "family" = sub.metadata.tier === "family" ? "family" : "individual";
    const isEnded = REVOKING_SUBSCRIPTION_STATUSES.has(sub.status);

    const hasLocal =
      tier === "family" ? await hasActiveFamilyMembership(admin, sub.id) : await hasActiveIndividualEntitlement(admin, hostId);

    if (!isEnded && !hasLocal) {
      // Stripe active, no local entitlement -- surfaced only, see module
      // comment for why this direction is never auto-corrected.
      findings.push({
        type: "stripe_active_no_local_entitlement",
        hostId,
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
        tier,
        corrected: false,
      });
    } else if (isEnded && hasLocal) {
      // Stripe ended, local still active -- safe to auto-correct using the
      // exact same functions the webhook itself would have called.
      let correctionError: string | undefined;
      try {
        if (tier === "family") {
          await cancelFamilyMembership(admin, sub.id);
        } else {
          const { error } = await revokeIndividualEntitlement(admin, hostId);
          if (error) correctionError = error;
        }
      } catch (err) {
        correctionError = err instanceof Error ? err.message : String(err);
      }
      findings.push({
        type: "local_active_stripe_ended",
        hostId,
        stripeSubscriptionId: sub.id,
        stripeStatus: sub.status,
        tier,
        corrected: !correctionError,
        correctionError,
      });
    }
  }

  const correctedCount = findings.filter((f) => f.corrected).length;
  const surfacedCount = findings.filter((f) => !f.corrected).length;

  return { findings, correctedCount, surfacedCount, subscriptionsChecked: avaiaSubs.length };
}

/** For the founder digest: only what still needs a human look -- an
 *  uncorrected mismatch (either direction: a grant that was never made, or
 *  a correction that itself failed), never the routine auto-corrected
 *  ones (those are exactly what "self-correcting" means and don't need
 *  Dorian told about each one individually). */
export async function getUnresolvedReconciliationFindings(): Promise<ReconciliationFinding[]> {
  // Re-running detection (not re-correcting) would double-report already-
  // corrected cases as still-mismatched between cron runs, so this reads
  // the most recent run's own recorded detail from cron_runs rather than
  // re-querying Stripe a second time within the same digest build.
  const admin = createAdminClient();
  const { data } = await admin
    .from("cron_runs")
    .select("detail")
    .eq("cron_name", "entitlement-reconciliation")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const findings = (data?.detail as { findings?: ReconciliationFinding[] } | null)?.findings ?? [];
  return findings.filter((f) => !f.corrected);
}
