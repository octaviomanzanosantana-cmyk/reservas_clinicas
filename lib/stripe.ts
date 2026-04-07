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
  price_1TJMrvAL0qP42ZSx0gA2PNWy: "starter",
  price_1TJMtGAL0qP42ZSxnzv9TL7s: "starter",
  price_1TJMtwAL0qP42ZSxJrQzKgzT: "pro",
  price_1TJMuTAL0qP42ZSxN2bRe0nK: "pro",
};

/** Map plan + interval to Stripe price ID */
export const PLAN_PRICES: Record<string, Record<string, string>> = {
  starter: {
    monthly: "price_1TJMrvAL0qP42ZSx0gA2PNWy",
    yearly: "price_1TJMtGAL0qP42ZSxnzv9TL7s",
  },
  pro: {
    monthly: "price_1TJMtwAL0qP42ZSxJrQzKgzT",
    yearly: "price_1TJMuTAL0qP42ZSxN2bRe0nK",
  },
};
