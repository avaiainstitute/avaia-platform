import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, REVOKING_SUBSCRIPTION_STATUSES } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, memberWelcomeEmailHtml } from "@/lib/resend";
import { createFamilyMembership, cancelFamilyMembership } from "@/lib/family-membership";
import { revokeIndividualEntitlement } from "@/lib/membership";
import { alertOps } from "@/lib/ops/alerts";
import { completePaymentMethodSetup } from "@/lib/ops/certification-admissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVOKING_STATUSES = REVOKING_SUBSCRIPTION_STATUSES;

/** LEGACY. The original $4,500 Certified AVAIA Guide Program path is
 *  CLOSED (owner decision): payment no longer opens candidacy, and no
 *  checkout can be created for it anymore. This handler remains only so a
 *  checkout session that was already open when the path closed (Stripe
 *  sessions live up to 24 hours) cannot lose the fact of the payment: the
 *  payment is still recorded (money-received integrity, idempotent via
 *  stripe_checkout_session_id's unique constraint -- a redelivered event's
 *  duplicate insert is caught as 23505 and ignored), and Dorian is told so
 *  he can decide what to do (for example refund). It NEVER creates a
 *  guide_candidates row or changes any status: a payment must not
 *  auto-create candidacy. */
async function recordGuideCertificationPayment(
  hostId: string | null | undefined,
  session: Stripe.Checkout.Session
) {
  if (!hostId) {
    console.error("AVAIA Stripe webhook: no supabase_user_id on the guide certification event, skipping.");
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin.from("guide_certification_payments").insert({
    host_id: hostId,
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    amount_cents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });
  if (error) {
    if (error.code !== "23505") {
      console.error("AVAIA Stripe webhook: failed to record guide certification payment:", error);
      await alertOps("Certification payment received but failed to record", [
        `Host ID: ${hostId}`,
        `Stripe checkout session: ${session.id}`,
        `Error: ${error.message}`,
        "This payment succeeded in Stripe but the local record failed to save -- check Stripe directly and reconcile manually.",
      ]);
    }
    // Either a real failure, or a redelivered event for a payment already
    // on file -- either way, do not send the notice below again.
    return;
  }
  await alertOps("Payment received on the CLOSED $4,500 Guide certification path", [
    `Host ID: ${hostId}`,
    `Amount: ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? "usd").toUpperCase()}`,
    `Stripe checkout session: ${session.id}`,
    "This enrollment path is closed. The payment was recorded for the record, but NO candidacy was created and nothing else changed. Decide how to handle it (for example, refund in Stripe).",
  ]);
}

/** Grants this Host an active Individual entitlement. Idempotent, Stripe
 *  may redeliver the same event, and this must never create a second
 *  active entitlement for a Host who already has one. The `existing` check
 *  below is also the safe point to decide whether to send the member
 *  welcome email exactly once: a redelivered event for an already-active
 *  member returns before ever reaching the email send. */
async function grantEntitlement(hostId: string | null | undefined, origin: string) {
  if (!hostId) {
    console.error("AVAIA Stripe webhook: no supabase_user_id on the event, skipping.");
    return;
  }
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("entitlements")
    .select("id, source")
    .eq("host_id", hostId)
    .eq("status", "active")
    .maybeSingle();
  if (existing && existing.source === "candidacy") {
    // A certification candidate who now pays for a membership: convert their
    // candidacy access into the membership entitlement, so it no longer ends
    // with candidacy (that rule only ever touches source 'candidacy').
    const { error: convertError } = await admin
      .from("entitlements")
      .update({ source: "individual", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (convertError) {
      console.error("AVAIA Stripe webhook: failed to convert candidacy access to membership:", convertError);
      await alertOps("Payment succeeded but membership could not replace candidacy access", [
        `Host ID: ${hostId}`,
        `Error: ${convertError.message}`,
        "This certification candidate paid for a membership but their access is still the candidacy kind, which ends with candidacy. Check Stripe and the entitlements table.",
      ]);
      return;
    }
    await sendMemberWelcomeEmail(admin, hostId, origin);
    return;
  }
  if (existing) return;
  const { error } = await admin
    .from("entitlements")
    .insert({ host_id: hostId, status: "active", source: "individual" });
  if (error) {
    console.error("AVAIA Stripe webhook: failed to grant entitlement:", error);
    // Audit finding #4: this is the exact "paid but no access" gap -- Stripe
    // already has the Host's money and thinks this succeeded; without this,
    // the only way anyone finds out is the Host discovering they have no
    // access and emailing in.
    await alertOps("Payment succeeded but entitlement grant failed", [
      `Host ID: ${hostId}`,
      `Error: ${error.message}`,
      "This Host paid but does not currently have active access. Check Stripe and the entitlements table, and grant access manually once confirmed.",
    ]);
    return;
  }
  await sendMemberWelcomeEmail(admin, hostId, origin);
}

/** Best-effort only, never blocks or fails entitlement granting itself; a
 *  Host who paid gets access whether or not this email succeeds. Only
 *  called from the branch above where a NEW entitlement row was just
 *  inserted, so this never re-sends on a webhook redelivery. Silently does
 *  nothing if the Host has no email on file yet (e.g. still anonymous at
 *  the moment of payment), there's nowhere to send it. */
async function sendMemberWelcomeEmail(
  admin: ReturnType<typeof createAdminClient>,
  hostId: string,
  origin: string
) {
  try {
    const { data, error } = await admin.auth.admin.getUserById(hostId);
    const email = data?.user?.email;
    if (error || !email) return;
    await sendEmail({
      to: email,
      subject: "Welcome to AVAIA",
      html: memberWelcomeEmailHtml({ journeyUrl: `${origin}/journey` }),
    });
  } catch (e) {
    console.error("AVAIA Stripe webhook: failed to send member welcome email:", e);
  }
}

/** Revokes this Host's active entitlement when their paid subscription
 *  ends, access only. Never touches profiles, conversations, messages,
 *  referrals, Workbook, or Library data; only this Host's own
 *  entitlements row(s) change. */
async function revokeEntitlement(hostId: string | null | undefined) {
  if (!hostId) {
    console.error("AVAIA Stripe webhook: no supabase_user_id on the subscription event, skipping.");
    return;
  }
  const { error } = await revokeIndividualEntitlement(createAdminClient(), hostId);
  if (error) console.error("AVAIA Stripe webhook: failed to revoke entitlement:", error);
}

/** Creates the Family plan itself the moment the Family base-price
 *  Checkout Session completes, mirrors grantEntitlement()'s idempotency
 *  posture (createFamilyMembership is itself idempotent against
 *  redelivery, see its own doc comment). Retrieves the just-created
 *  subscription to capture its one line item's id (base_subscription_item_id)
 * , needed later so an additional-member invite can add a SECOND item to
 *  this same subscription rather than creating a new one. */
async function grantFamilyMembership(
  hostId: string | null | undefined,
  session: Stripe.Checkout.Session,
  origin: string
) {
  if (!hostId) {
    console.error("AVAIA Family webhook: no supabase_user_id on the event, skipping.");
    return;
  }
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!subscriptionId || !customerId) {
    console.error("AVAIA Family webhook: checkout session missing subscription/customer id.");
    return;
  }
  const plan = session.metadata?.plan === "annual" ? "annual" : "monthly";
  const admin = createAdminClient();

  let baseItemId: string | undefined;
  try {
    const subscription = await stripe().subscriptions.retrieve(subscriptionId);
    baseItemId = subscription.items.data[0]?.id;
  } catch (e) {
    console.error("AVAIA Family webhook: failed to retrieve subscription:", e);
  }
  if (!baseItemId) {
    await alertOps("Family Membership payment succeeded but plan creation failed", [
      `Host ID: ${hostId}`,
      `Stripe subscription: ${subscriptionId}`,
      "Could not retrieve the subscription's line item from Stripe, so no Family plan was created. This Host paid but has no Family plan or access. Check Stripe and set this up manually.",
    ]);
    return;
  }

  const { data: authUser } = await admin.auth.admin.getUserById(hostId);
  const ownerEmail = authUser?.user?.email ?? null;

  const created = await createFamilyMembership(admin, hostId, ownerEmail, customerId, subscriptionId, baseItemId, plan);
  if (!created) {
    await alertOps("Family Membership payment succeeded but plan creation failed", [
      `Host ID: ${hostId}`,
      `Stripe subscription: ${subscriptionId}`,
      "createFamilyMembership failed to save the plan (see server logs for the database error). This Host paid but has no Family plan or access. Check Stripe and set this up manually.",
    ]);
    return;
  }
  if (created && ownerEmail) {
    try {
      await sendEmail({
        to: ownerEmail,
        subject: "Welcome to AVAIA Family Membership",
        html: memberWelcomeEmailHtml({ journeyUrl: `${origin}/family` }),
      });
    } catch (e) {
      console.error("AVAIA Family webhook: failed to send welcome email:", e);
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("AVAIA Stripe webhook: signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const hostId = session.client_reference_id ?? session.metadata?.supabase_user_id;
    // Stripe calls this endpoint directly, so request.url's origin is
    // AVAIA's own live domain, the same value the checkout route itself
    // would compute, used only for the welcome email's Journey link.
    const origin = new URL(request.url).origin;
    if (session.mode === "setup" && session.metadata?.product === "certification_application_setup") {
      // A certification applicant saved a payment method. Nothing is charged:
      // the $1,495 is charged only after a human admission decision.
      await completePaymentMethodSetup(session);
    } else if (session.metadata?.product === "guide_certification") {
      await recordGuideCertificationPayment(hostId, session);
    } else if (session.metadata?.tier === "family") {
      await grantFamilyMembership(hostId, session, origin);
    } else {
      await grantEntitlement(hostId, origin);
    }
  } else if (event.type === "customer.subscription.deleted") {
    // subscription_data.metadata (set at checkout) carries supabase_user_id
    // onto the Subscription object itself, no stored Stripe-customer
    // lookup table is needed to resolve which Host this is.
    const subscription = event.data.object as Stripe.Subscription;
    if (subscription.metadata?.tier === "family") {
      await cancelFamilyMembership(createAdminClient(), subscription.id);
    } else {
      await revokeEntitlement(subscription.metadata?.supabase_user_id);
    }
  } else if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    if (REVOKING_STATUSES.has(subscription.status)) {
      if (subscription.metadata?.tier === "family") {
        await cancelFamilyMembership(createAdminClient(), subscription.id);
      } else {
        await revokeEntitlement(subscription.metadata?.supabase_user_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
