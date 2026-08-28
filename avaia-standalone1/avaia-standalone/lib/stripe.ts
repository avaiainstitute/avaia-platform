import "server-only";
import Stripe from "stripe";

/** Server-only Stripe client. The secret key never reaches the browser. */
export function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-07-29.dahlia",
  });
}

export type MembershipPlan = "monthly" | "annual";

/** AVAIA Membership Price IDs -- one per billing interval. Swap the values
 *  in Vercel env vars whenever a price changes; nothing else needs to change. */
const MEMBERSHIP_PRICE_IDS: Record<MembershipPlan, string | undefined> = {
  monthly: process.env.STRIPE_MEMBERSHIP_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_MEMBERSHIP_PRICE_ID_ANNUAL,
};

export function membershipPriceId(plan: MembershipPlan): string | undefined {
  return MEMBERSHIP_PRICE_IDS[plan];
}
