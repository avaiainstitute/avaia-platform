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

  // Where to land after Stripe redirects back — validated against a fixed
  // allowlist rather than trusted as-is, since this becomes part of a URL
  // handed to Stripe. Falls back to /journey for anything unrecognized.
  const ALLOWED_RETURN_PATHS = ["/journey", "/defying-grief"];
  // A Library entry's return path is per-entry (its id), so it can't live
  // in the fixed array above -- validated by shape instead of membership,
  // same defensive posture: never trust the client value as-is. Strict
  // UUID match only, same-origin by construction (used as `${origin}${returnTo}`
  // below), so this can't become an open redirect.
  const LIBRARY_ENTRY_RETURN_PATH =
    /^\/library\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const body = await request.json().catch(() => ({}));
  const requestedReturnTo = typeof body?.returnTo === "string" ? body.returnTo : "";
  const returnTo =
    ALLOWED_RETURN_PATHS.includes(requestedReturnTo) || LIBRARY_ENTRY_RETURN_PATH.test(requestedReturnTo)
      ? requestedReturnTo
      : "/journey";

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: MEMBERSHIP_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
      success_url: `${origin}${returnTo}?checkout=success`,
      cancel_url: `${origin}${returnTo}?checkout=cancelled`,
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
