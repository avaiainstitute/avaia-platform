import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sets membership_status = 'member' for the Host tied to this Stripe object,
 *  via client_reference_id (checkout session) or the metadata we set at
 *  checkout time (subscription_data.metadata carries it onto the subscription). */
async function grantMembership(hostId: string | null | undefined) {
  if (!hostId) {
    console.error("AVAIA Stripe webhook: no supabase_user_id on the event, skipping.");
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ membership_status: "member" })
    .eq("id", hostId);
  if (error) console.error("AVAIA Stripe webhook: failed to update membership_status:", error);
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
    await grantMembership(hostId);
  }

  return NextResponse.json({ received: true });
}
