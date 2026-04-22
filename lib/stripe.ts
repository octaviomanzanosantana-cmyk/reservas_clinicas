import "server-only";

import Stripe from "stripe";

export type StripePlan = "starter" | "pro";
export type StripeInterval = "monthly" | "yearly";

/**
 * Stripe mode: "test" during development, "live" in production after cutover.
 * Read from STRIPE_MODE env var. Defaults to "test" for safety.
 */
function getStripeMode(): "test" | "live" {
  const mode = process.env.STRIPE_MODE?.trim().toLowerCase();
  if (mode === "live") return "live";
  if (mode === "test") return "test";
  // Safety default: if STRIPE_MODE is missing or malformed, assume test.
  return "test";
}

/**
 * Returns the env var name to use for a given Stripe config item,
 * based on the current STRIPE_MODE.
 */
function envKey(base: string): string {
  const suffix = getStripeMode() === "live" ? "_LIVE" : "_TEST";
  return `${base}${suffix}`;
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const keyName = envKey("STRIPE_SECRET_KEY");
    const key = process.env[keyName]?.trim();
    if (!key) {
      throw new Error(
        `Missing ${keyName} environment variable (STRIPE_MODE=${getStripeMode()})`
      );
    }
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

/**
 * Returns the Stripe webhook signing secret for the current mode.
 * Used to verify signatures in the webhook route.
 */
export function getStripeWebhookSecret(): string {
  const keyName = envKey("STRIPE_WEBHOOK_SECRET");
  const secret = process.env[keyName]?.trim();
  if (!secret) {
    throw new Error(
      `Missing ${keyName} environment variable (STRIPE_MODE=${getStripeMode()})`
    );
  }
  return secret;
}

/**
 * Returns the Stripe publishable key for the current mode.
 * Safe to use in client components (only exposes the public key).
 */
export function getStripePublishableKey(): string {
  const mode = getStripeMode();
  const key =
    mode === "live"
      ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE?.trim()
      : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST?.trim();
  if (!key) {
    throw new Error(
      `Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${mode.toUpperCase()} environment variable`
    );
  }
  return key;
}

/**
 * Map of plan + interval to Stripe price ID.
 * Built at runtime from env vars so test/live switching requires only
 * changing STRIPE_MODE.
 *
 * Pro intentionally has no price IDs configured: the product is archived
 * in LIVE and not created in TEST. Attempts to look up PLAN_PRICES.pro
 * will return undefined values, which is the correct behavior — Pro is
 * not purchasable until the waitlist is activated.
 */
export const PLAN_PRICES: Record<
  StripePlan,
  Record<StripeInterval, string | undefined>
> = {
  starter: {
    monthly: process.env[envKey("STRIPE_PRICE_STARTER_MONTHLY")]?.trim(),
    yearly: process.env[envKey("STRIPE_PRICE_STARTER_YEARLY")]?.trim(),
  },
  pro: {
    monthly: undefined,
    yearly: undefined,
  },
};

/**
 * Reverse lookup: price ID → plan name. Derived automatically from
 * PLAN_PRICES so there is only one source of truth.
 */
export const PRICE_TO_PLAN: Record<string, StripePlan> = (() => {
  const map: Record<string, StripePlan> = {};
  for (const plan of ["starter", "pro"] as const satisfies readonly StripePlan[]) {
    for (const interval of ["monthly", "yearly"] as const satisfies readonly StripeInterval[]) {
      const priceId = PLAN_PRICES[plan][interval];
      if (priceId) {
        map[priceId] = plan;
      }
    }
  }
  return map;
})();
