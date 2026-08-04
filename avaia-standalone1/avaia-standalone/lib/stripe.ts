import "server-only";
import Stripe from "stripe";

/** Server-only Stripe client. The secret key never reaches the browser. */
export function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-07-29.dahlia",
  });
}

/** Placeholder membership subscription price — swap the Price ID in Vercel env
 *  vars whenever the real price is set; nothing else needs to change. */
export const MEMBERSHIP_PRICE_ID = process.env.STRIPE_MEMBERSHIP_PRICE_ID!;
