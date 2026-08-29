import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, memberWelcomeEmailHtml } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Subscription statuses that mean the Host is no longer a paying member --
 *  deliberately excludes 'past_due' (Stripe's own retry/grace period; not
 *  yet a real end of access) and 'trialing'/'incomplete'/'paused', which
 *  aren't a prior active paid state ending. */
const REVOKING_STATUSES = new Set(["canceled", "unpaid", "incomplete_expired"]);

/** Grants this Host an active Individual entitlement. Idempotent -- Stripe
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
    .select("id")
    .eq("host_id", hostId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return;
  const { error } = await admin
    .from("entitlements")
    .insert({ host_id: hostId, status: "active", source: "individual" });
  if (error) {
    console.error("AVAIA Stripe webhook: failed to grant entitlement:", error);
    return;
  }
  await sendMemberWelcomeEmail(admin, hostId, origin);
}

/** Best-effort only -- never blocks or fails entitlement granting itself; a
 *  Host who paid gets access whether or not this email succeeds. Only
 *  called from the branch above where a NEW entitlement row was just
 *  inserted, so this never re-sends on a webhook redelivery. Silently does
 *  nothing if the Host has no email on file yet (e.g. still anonymous at
 *  the moment of payment) -- there's nowhere to send it. */
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
 *  ends -- access only. Never touches profiles, conversations, messages,
 *  referrals, Workbook, or Library data; only this Host's own
 *  entitlements row(s) change. */
async function revokeEntitlement(hostId: string | null | undefined) {
  if (!hostId) {
    console.error("AVAIA Stripe webhook: no supabase_user_id on the subscription event, skipping.");
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("entitlements")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("host_id", hostId)
    .eq("status", "active");
  if (error) console.error("AVAIA Stripe webhook: failed to revoke entitlement:", error);
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
    // AVAIA's own live domain -- the same value the checkout route itself
    // would compute -- used only for the welcome email's Journey link.
    const origin = new URL(request.url).origin;
    await grantEntitlement(hostId, origin);
  } else if (event.type === "customer.subscription.deleted") {
    // subscription_data.metadata (set at checkout) carries supabase_user_id
    // onto the Subscription object itself -- no stored Stripe-customer
    // lookup table is needed to resolve which Host this is.
    const subscription = event.data.object as Stripe.Subscription;
    await revokeEntitlement(subscription.metadata?.supabase_user_id);
  } else if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    if (REVOKING_STATUSES.has(subscription.status)) {
      await revokeEntitlement(subscription.metadata?.supabase_user_id);
    }
  }

  return NextResponse.json({ received: true });
}
