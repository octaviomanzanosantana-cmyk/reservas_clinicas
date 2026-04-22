import { NextResponse, type NextRequest } from "next/server";
import { getStripe, PRICE_TO_PLAN, getStripeWebhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

// Disable body parsing — Stripe needs raw body for signature verification
export const runtime = "nodejs";

type ClinicSubStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "free";

/** Map Stripe subscription status to our internal subscription_status. */
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): ClinicSubStatus | null {
  switch (stripeStatus) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    // incomplete, incomplete_expired, paused — not mapped, caller decides
    default:
      return null;
  }
}

/** Convert Unix timestamp to ISO string, safely. */
function tsToIso(ts: number | null | undefined): string | null {
  if (!ts || typeof ts !== "number") return null;
  return new Date(ts * 1000).toISOString();
}

/** Log helper that redacts potentially sensitive info. */
function logEvent(event: Stripe.Event, msg: string, extra?: Record<string, unknown>) {
  console.log(
    `[stripe-webhook] ${event.type} ${event.id} — ${msg}`,
    extra ? { ...extra } : "",
  );
}

function logWarn(event: Stripe.Event, msg: string, extra?: Record<string, unknown>) {
  console.warn(
    `[stripe-webhook] ${event.type} ${event.id} — WARN: ${msg}`,
    extra ? { ...extra } : "",
  );
}

// ============================================================================
// Handlers
// ============================================================================

async function handleSubscriptionCreatedOrUpdated(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  // Locate clinic by customer or subscription id
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, slug, subscription_status, plan")
    .or(
      `stripe_customer_id.eq.${customerId},stripe_subscription_id.eq.${subscription.id}`,
    )
    .maybeSingle();

  if (!clinic) {
    logWarn(event, "clinic not found for customer/subscription", {
      customerId,
      subscriptionId: subscription.id,
    });
    return;
  }

  // Map Stripe status to our status
  const newStatus = mapStripeStatus(subscription.status);
  if (!newStatus) {
    logWarn(event, "unmapped Stripe status — skipping", {
      stripeStatus: subscription.status,
      clinicSlug: clinic.slug,
    });
    return;
  }

  // Map price id to plan name
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const mappedPlan = priceId ? PRICE_TO_PLAN[priceId] : null;

  if (priceId && !mappedPlan) {
    logWarn(event, "priceId not mapped to a plan — keeping current plan", {
      priceId,
      clinicSlug: clinic.slug,
    });
  }

  // Handle cancel_at_period_end: user requested cancellation but period still active
  const effectiveStatus: ClinicSubStatus =
    subscription.cancel_at_period_end && newStatus === "active"
      ? "canceled"
      : newStatus;

  // Build update payload
  const update: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: effectiveStatus,
    plan_expires_at: tsToIso(item?.current_period_end ?? null),
  };

  if (mappedPlan) {
    update.plan = mappedPlan;
  }

  if (subscription.status === "trialing") {
    update.trial_ends_at = tsToIso(subscription.trial_end);
  } else if (newStatus === "active") {
    update.trial_ends_at = null;
  }

  if (effectiveStatus === "canceled" && clinic.subscription_status !== "canceled") {
    update.canceled_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("clinics")
    .update(update)
    .eq("id", clinic.id);

  if (error) {
    logWarn(event, "supabase update failed", { clinicSlug: clinic.slug, error: error.message });
    throw new Error(`Supabase update failed: ${error.message}`);
  }

  logEvent(event, `clinic ${clinic.slug} updated`, {
    status: effectiveStatus,
    plan: update.plan ?? clinic.plan,
  });
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
): Promise<void> {
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, slug")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!clinic) {
    logWarn(event, "clinic not found for subscription.deleted", {
      subscriptionId: subscription.id,
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from("clinics")
    .update({
      plan: "free",
      subscription_status: "free",
      stripe_subscription_id: null,
      plan_expires_at: null,
      trial_ends_at: null,
    })
    .eq("id", clinic.id);

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }

  logEvent(event, `clinic ${clinic.slug} downgraded to free`);
}

async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) {
    logWarn(event, "invoice has no customer — skipping");
    return;
  }

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, slug, subscription_status")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!clinic) {
    logWarn(event, "clinic not found for invoice.payment_succeeded", {
      customerId,
    });
    return;
  }

  // Update clinic: promote from past_due to active if applicable, extend period
  const update: Record<string, unknown> = {};

  if (clinic.subscription_status === "past_due") {
    update.subscription_status = "active";
  }

  const periodEnd = (invoice as unknown as { period_end?: number }).period_end;
  if (periodEnd) {
    update.plan_expires_at = tsToIso(periodEnd);
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin
      .from("clinics")
      .update(update)
      .eq("id", clinic.id);

    if (error) {
      throw new Error(`Supabase update failed: ${error.message}`);
    }
  }

  // Create invoice record
  const chargeId =
    typeof (invoice as unknown as { charge?: unknown }).charge === "string"
      ? ((invoice as unknown as { charge: string }).charge)
      : null;

  const { error: invoiceError } = await supabaseAdmin.from("invoices").insert({
    clinic_id: clinic.id,
    stripe_invoice_id: invoice.id,
    stripe_charge_id: chargeId,
    amount_cents: invoice.amount_paid ?? invoice.total ?? 0,
    currency: (invoice.currency ?? "eur").toUpperCase(),
    issued_at: tsToIso(invoice.created),
  });

  if (invoiceError) {
    // Non-fatal: invoice record is nice-to-have but subscription state is source of truth
    logWarn(event, "invoice row insert failed", {
      clinicSlug: clinic.slug,
      error: invoiceError.message,
    });
  }

  logEvent(event, `clinic ${clinic.slug} payment succeeded`, {
    amount: invoice.amount_paid,
  });
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) {
    logWarn(event, "invoice has no customer — skipping");
    return;
  }

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, slug")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!clinic) {
    logWarn(event, "clinic not found for invoice.payment_failed", {
      customerId,
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from("clinics")
    .update({ subscription_status: "past_due" })
    .eq("id", clinic.id);

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`);
  }

  logEvent(event, `clinic ${clinic.slug} marked past_due`);
}

// ============================================================================
// Main POST handler
// ============================================================================

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const webhookSecret = getStripeWebhookSecret();
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe-webhook] signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Idempotency: try to claim the event atomically.
  // If the insert fails due to PK conflict, we've seen this event already.
  const { error: claimError } = await supabaseAdmin
    .from("stripe_events_processed")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
    });

  if (claimError) {
    // PostgreSQL unique violation code is "23505"
    if (claimError.code === "23505") {
      console.log(
        `[stripe-webhook] ${event.type} ${event.id} — already processed, skipping`,
      );
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Other DB error — let Stripe retry
    console.error(
      `[stripe-webhook] ${event.type} ${event.id} — claim failed:`,
      claimError.message,
    );
    return NextResponse.json(
      { error: "Claim failed" },
      { status: 500 },
    );
  }

  // Event claimed. Process it.
  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreatedOrUpdated(event, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(event, subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(event, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(event, invoice);
        break;
      }

      default:
        logWarn(event, "unhandled event type");
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[stripe-webhook] ${event.type} ${event.id} — processing error:`,
      message,
    );
    // Event was claimed but processing failed. To allow retry, we remove the claim.
    await supabaseAdmin
      .from("stripe_events_processed")
      .delete()
      .eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
