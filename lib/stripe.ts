import "server-only";

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

/** Map price IDs to plan names */
export const PRICE_TO_PLAN: Record<string, string> = {
  price_1TJLSFGnSoIbffiSC8Z7euY1: "starter",
  price_1TJLVBGnSoIbffiSd4t08wsX: "starter",
  price_1TJLVtGnSoIbffiS04FAdDTo: "pro",
  price_1TJLWtGnSoIbffiSRZJ3MZRN: "pro",
};

/** Map plan + interval to Stripe price ID */
export const PLAN_PRICES: Record<string, Record<string, string>> = {
  starter: {
    monthly: "price_1TJLSFGnSoIbffiSC8Z7euY1",
    yearly: "price_1TJLVBGnSoIbffiSd4t08wsX",
  },
  pro: {
    monthly: "price_1TJLVtGnSoIbffiS04FAdDTo",
    yearly: "price_1TJLWtGnSoIbffiSRZJ3MZRN",
  },
};
