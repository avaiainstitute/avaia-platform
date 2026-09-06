import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, guideCertificationPriceId } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pay-in-full checkout for the $4,500 Certified AVAIA Guide Program --
 *  mode "payment" (one-time), not "subscription", matching the actual
 *  program price. No installment option is offered here; that requires a
 *  separate, later owner decision (see the Certified Guide audit's Final
 *  Report) -- this route only ever creates a single, full-amount charge. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const origin = new URL(request.url).origin;
  const priceId = guideCertificationPriceId();

  if (!process.env.STRIPE_SECRET_KEY || !priceId) {
    return NextResponse.json({ error: "Stripe is not configured in this deployment." }, { status: 500 });
  }

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: { supabase_user_id: user.id, product: "guide_certification" },
      success_url: `${origin}/certified-guide/enroll?checkout=success`,
      cancel_url: `${origin}/certified-guide/enroll?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("AVAIA Stripe Guide Certification checkout error:", e);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 502 }
    );
  }
}
