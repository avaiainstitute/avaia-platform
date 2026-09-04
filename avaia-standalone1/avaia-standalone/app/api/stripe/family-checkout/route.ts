import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, familyBasePriceId, type MembershipPlan } from "@/lib/stripe";
import { getFamilyMembershipForOwner } from "@/lib/family-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMBERSHIP_PLANS: MembershipPlan[] = ["monthly", "annual"];

/** Starts Stripe Checkout for a NEW Family Membership plan -- deliberately
 *  separate from /api/stripe/checkout (Individual) rather than a shared
 *  route with a "tier" branch, so Individual checkout -- already proven
 *  live -- is never touched by this feature. Creates a subscription for
 *  the Family base price only (quantity 1, covers the first 5 seats);
 *  additional members are billed later, as a separate subscription item,
 *  only once actually invited (see lib/family-membership.ts). The plan
 *  record itself and the owner's own active seat are created by the
 *  webhook's checkout.session.completed handler, not here -- this route
 *  only ever starts a Checkout Session. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const existing = await getFamilyMembershipForOwner(supabase, user.id);
  if (existing) {
    return NextResponse.json({ error: "You already have an active Family Membership." }, { status: 409 });
  }

  const origin = new URL(request.url).origin;
  const body = await request.json().catch(() => ({}));

  const requestedPlan = typeof body?.plan === "string" ? body.plan : "monthly";
  const plan: MembershipPlan = MEMBERSHIP_PLANS.includes(requestedPlan as MembershipPlan)
    ? (requestedPlan as MembershipPlan)
    : "monthly";
  const priceId = familyBasePriceId(plan);

  if (!process.env.STRIPE_SECRET_KEY || !priceId) {
    return NextResponse.json({ error: "Family Membership billing isn't configured in this deployment." }, { status: 500 });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: { supabase_user_id: user.id, tier: "family", plan },
      subscription_data: { metadata: { supabase_user_id: user.id, tier: "family", plan } },
      success_url: `${origin}/family?checkout=success`,
      cancel_url: `${origin}/membership?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("AVAIA Family checkout error:", e);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }
}
