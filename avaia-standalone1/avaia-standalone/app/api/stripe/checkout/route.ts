import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, MEMBERSHIP_PRICE_ID } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY || !MEMBERSHIP_PRICE_ID) {
    return NextResponse.json({ error: "Stripe is not configured in this deployment." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: MEMBERSHIP_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${origin}/journey?checkout=success`,
      cancel_url: `${origin}/journey?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("AVAIA Stripe checkout error:", e);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }
}
