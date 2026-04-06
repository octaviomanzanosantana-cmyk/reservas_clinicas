import { NextResponse, type NextRequest } from "next/server";
import { getStripe, PRICE_TO_PLAN } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

// Disable body parsing — Stripe needs raw body for signature verification
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  // STRIPE_WEBHOOK_SECRET — configure in .env.local after setting up webhook in Stripe Dashboard
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clinicId = session.metadata?.clinic_id;
        const planId = session.metadata?.plan_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (clinicId && planId && subscriptionId) {
          await supabaseAdmin
            .from("clinics")
            .update({
              plan: planId,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id:
                typeof session.customer === "string"
                  ? session.customer
                  : session.customer?.id,
            })
            .eq("id", clinicId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("clinics")
          .update({
            plan: "free",
            stripe_subscription_id: null,
            plan_expires_at: null,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const item = subscription.items.data[0];
        const priceId = item?.price?.id;
        const newPlan = priceId ? PRICE_TO_PLAN[priceId] : null;

        if (newPlan) {
          const periodEnd = item?.current_period_end;
          await supabaseAdmin
            .from("clinics")
            .update({
              plan: newPlan,
              plan_expires_at: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Error processing webhook event:", err);
    return NextResponse.json(
      { error: "Error processing event" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
