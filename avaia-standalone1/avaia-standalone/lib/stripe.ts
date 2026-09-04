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

/** AVAIA Family Membership -- base plan ($49/mo or $490/yr, covers the
 *  first 5 seats) and the additional-member price ($7/mo or $70/yr each,
 *  used as a separate subscription line item added/incremented only once
 *  a 6th person joins). Same env-var-swap posture as Individual pricing
 *  above -- nothing else needs to change when a price changes. */
const FAMILY_BASE_PRICE_IDS: Record<MembershipPlan, string | undefined> = {
  monthly: process.env.STRIPE_FAMILY_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_FAMILY_PRICE_ID_ANNUAL,
};

const FAMILY_EXTRA_SEAT_PRICE_IDS: Record<MembershipPlan, string | undefined> = {
  monthly: process.env.STRIPE_FAMILY_EXTRA_SEAT_PRICE_ID_MONTHLY,
  annual: process.env.STRIPE_FAMILY_EXTRA_SEAT_PRICE_ID_ANNUAL,
};

export function familyBasePriceId(plan: MembershipPlan): string | undefined {
  return FAMILY_BASE_PRICE_IDS[plan];
}

export function familyExtraSeatPriceId(plan: MembershipPlan): string | undefined {
  return FAMILY_EXTRA_SEAT_PRICE_IDS[plan];
}

/** Included seats in the Family base price (the purchaser + 4 more).
 *  A 6th and further person each bill as an additional seat. */
export const FAMILY_INCLUDED_SEATS = 5;
