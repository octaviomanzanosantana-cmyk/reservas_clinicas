import { NextResponse, type NextRequest } from "next/server";
import { getStripe, PRICE_TO_PLAN, getStripeWebhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";
import {
  sendPaymentMethodAddedEmail,
  sendPaymentSucceededEmail,
  sendPaymentFailedEmail,
} from "@/lib/billingEmails";

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

/**
 * Devuelve el email del owner de una clínica, o null si no se
 * puede resolver. Loguea el motivo del null.
 */
async function getClinicOwnerEmail(
  event: Stripe.Event,
  clinicId: string,
): Promise<string | null> {
  const { data: ownerRow } = await supabaseAdmin
    .from("clinic_users")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .maybeSingle<{ user_id: string }>();

  if (!ownerRow?.user_id) {
    logWarn(event, "owner not found for clinic", { clinicId });
    return null;
  }

  const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(
    ownerRow.user_id,
  );
  const ownerEmail = userRow?.user?.email ?? null;

  if (!ownerEmail) {
    logWarn(event, "owner email not found for clinic", { clinicId });
    return null;
  }

  return ownerEmail;
}

/**
 * Formatea un importe en céntimos a "19 €" / "1.234,50 €".
 */
function formatAmount(amountCents: number, currency: string): string {
  const value = amountCents / 100;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

/**
 * Devuelve el label del plan + interval para emails.
 * priceId puede ser cualquier ID conocido en PRICE_TO_PLAN o no.
 */
function buildPlanLabel(
  priceId: string | null | undefined,
  interval: string | null | undefined,
): string {
  const plan = priceId ? PRICE_TO_PLAN[priceId] : null;
  const planName = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Plan";
  const intervalLabel =
    interval === "year" || interval === "yearly" ? "anual" : "mensual";
  return `${planName} ${intervalLabel}`;
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

  // Build update payload.
  // Durante un trial, item.current_period_end refleja el periodo actual
  // (≈ now), no la fecha de primer cobro. La "próxima renovación" que
  // el usuario espera ver es trial_end. Fuera de trial, usamos el
  // current_period_end del item.
  const nowUnixForExpiry = Math.floor(Date.now() / 1000);
  const candidateEndUnix =
    subscription.trial_end && subscription.trial_end > nowUnixForExpiry
      ? subscription.trial_end
      : item?.current_period_end ?? null;

  const update: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: effectiveStatus,
    plan_expires_at: tsToIso(candidateEndUnix),
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
  // Solo avanzamos plan_expires_at si hubo cobro real. Stripe emite
  // invoices de 0€ al iniciar el trial cuyo period_end ≈ ahora, y
  // pisarían la fecha correcta escrita por customer.subscription.created.
  // Mismo guard que ya protege el email "Cobro procesado" más abajo.
  if (periodEnd && (invoice.amount_paid ?? 0) > 0) {
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

  // Copia tax_regime desde tax_data (decisión de diseño documentada en
  // 20260423_sprint_comercial_fase_2a_tax_data.sql: el régimen se almacena,
  // no se recalcula). Fallback 'none' si tax_data falta — no debería pasar
  // porque setup-checkout exige tax_data antes de crear el Customer en Stripe.
  const { data: taxData } = await supabaseAdmin
    .from("tax_data")
    .select("tax_regime")
    .eq("clinic_id", clinic.id)
    .maybeSingle<{ tax_regime: string | null }>();

  if (!taxData) {
    console.warn(
      `[stripe-webhook] tax_data no encontrado para clinic_id=${clinic.id}, ` +
        `usando fallback 'none' en invoice ${invoice.id}`,
    );
  }

  const taxRegime = taxData?.tax_regime ?? "none";

  const { error: invoiceError } = await supabaseAdmin.from("invoices").insert({
    clinic_id: clinic.id,
    stripe_invoice_id: invoice.id,
    stripe_charge_id: chargeId,
    amount_cents: invoice.amount_paid ?? invoice.total ?? 0,
    currency: (invoice.currency ?? "eur").toUpperCase(),
    issued_at: tsToIso(invoice.created),
    tax_regime: taxRegime,
  });

  if (invoiceError) {
    // Non-fatal: invoice record is nice-to-have but subscription state is source of truth
    logWarn(event, "invoice row insert failed", {
      clinicSlug: clinic.slug,
      error: invoiceError.message,
    });
  }

  // Enviar email "Cobro procesado" — solo si hubo cobro real -----
  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid > 0) {
    try {
      const ownerEmail = await getClinicOwnerEmail(event, clinic.id);
      if (ownerEmail) {
        // Necesitamos el name de la clínica (no está en el SELECT actual)
        const { data: clinicFull } = await supabaseAdmin
          .from("clinics")
          .select("name")
          .eq("id", clinic.id)
          .maybeSingle<{ name: string }>();

        const clinicName = clinicFull?.name ?? clinic.slug;

        // Derivar plan/interval del primer line item de la invoice.
        // En Stripe API 2026-03-25.dahlia, el price vive bajo
        // pricing.price_details.price (puede ser id string o Price expandido).
        // recurring.interval no está disponible directamente — consultamos
        // el Price para obtenerlo.
        const line = invoice.lines?.data?.[0];
        const priceField = line?.pricing?.price_details?.price ?? null;
        const priceId =
          typeof priceField === "string"
            ? priceField
            : (priceField?.id ?? null);

        let intervalRaw: string | null = null;
        if (priceId) {
          try {
            const priceObj = await getStripe().prices.retrieve(priceId);
            intervalRaw = priceObj.recurring?.interval ?? null;
          } catch (priceErr) {
            logWarn(event, "could not retrieve price for interval lookup", {
              priceId,
              error:
                priceErr instanceof Error ? priceErr.message : String(priceErr),
            });
          }
        }

        const amountLabel = formatAmount(
          amountPaid,
          invoice.currency ?? "eur",
        );
        const planLabel = buildPlanLabel(priceId, intervalRaw);

        // Próxima fecha de cobro: end del periodo del line item
        const nextChargeUnix = line?.period?.end ?? null;
        const nextChargeAt =
          nextChargeUnix && typeof nextChargeUnix === "number"
            ? new Date(nextChargeUnix * 1000).toISOString()
            : new Date().toISOString();

        await sendPaymentSucceededEmail({
          toEmail: ownerEmail,
          toName: clinicName,
          clinicName,
          amountLabel,
          planLabel,
          nextChargeAt,
        });

        logEvent(event, "payment_succeeded email sent", {
          clinicId: clinic.id,
          toEmail: ownerEmail,
          amountPaid,
        });
      }
    } catch (err) {
      console.error("[stripe-webhook] payment_succeeded email failed", {
        clinicId: clinic.id,
        error: err instanceof Error ? err.message : String(err),
      });
      // No-throw: el handler ya hizo su trabajo (estado BD).
    }
  } else {
    logEvent(event, `clinic ${clinic.slug} invoice with amount=0 — no email`);
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

  // Enviar email "No hemos podido cobrar" --------------------------
  try {
    const ownerEmail = await getClinicOwnerEmail(event, clinic.id);
    if (ownerEmail) {
      const { data: clinicFull } = await supabaseAdmin
        .from("clinics")
        .select("name")
        .eq("id", clinic.id)
        .maybeSingle<{ name: string }>();

      const clinicName = clinicFull?.name ?? clinic.slug;

      const amountDue = invoice.amount_due ?? invoice.total ?? 0;
      const amountLabel = formatAmount(
        amountDue,
        invoice.currency ?? "eur",
      );

      await sendPaymentFailedEmail({
        toEmail: ownerEmail,
        toName: clinicName,
        clinicName,
        amountLabel,
      });

      logEvent(event, "payment_failed email sent", {
        clinicId: clinic.id,
        toEmail: ownerEmail,
        amountDue,
      });
    }
  } catch (err) {
    console.error("[stripe-webhook] payment_failed email failed", {
      clinicId: clinic.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // No-throw.
  }

  logEvent(event, `clinic ${clinic.slug} marked past_due`);
}

async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  const metadata = session.metadata ?? {};

  if (session.mode !== "setup") {
    logEvent(event, "checkout.session.completed skip: not setup mode", {
      mode: session.mode,
      sessionId: session.id,
    });
    return;
  }

  const clinicId = metadata.clinic_id?.trim();
  const interval = metadata.interval?.trim();
  const priceId = metadata.price_id?.trim();

  if (!clinicId || !interval || !priceId) {
    logWarn(event, "checkout.session.completed missing metadata", {
      clinicId,
      interval,
      priceId,
    });
    return;
  }

  if (interval !== "monthly" && interval !== "yearly") {
    logWarn(event, "checkout.session.completed invalid interval", { interval });
    return;
  }

  const setupIntentId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;

  if (!setupIntentId) {
    logWarn(event, "checkout.session.completed without setup_intent", {
      sessionId: session.id,
    });
    return;
  }

  // Expandir SetupIntent para obtener el payment_method
  const stripeForIntent = getStripe();
  const expandedIntent = await stripeForIntent.setupIntents.retrieve(
    setupIntentId,
  );

  const paymentMethodId =
    typeof expandedIntent.payment_method === "string"
      ? expandedIntent.payment_method
      : expandedIntent.payment_method?.id;

  if (!paymentMethodId) {
    logWarn(event, "setup_intent without payment_method after expand", {
      sessionId: session.id,
      setupIntentId,
    });
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!customerId) {
    logWarn(event, "checkout.session.completed without customer", {
      sessionId: session.id,
    });
    return;
  }

  // Leer la clínica
  const { data: clinic, error } = await supabaseAdmin
    .from("clinics")
    .select(
      "id, name, slug, stripe_subscription_id, trial_ends_at, stripe_customer_id",
    )
    .eq("id", clinicId)
    .maybeSingle<{
      id: string;
      name: string;
      slug: string;
      stripe_subscription_id: string | null;
      trial_ends_at: string | null;
      stripe_customer_id: string | null;
    }>();

  if (error || !clinic) {
    logWarn(event, "checkout.session.completed clinic not found", {
      clinicId,
      error: error?.message,
    });
    return;
  }

  // Idempotencia defensiva: si ya tiene subscription, saltar.
  if (clinic.stripe_subscription_id) {
    logEvent(event, "checkout.session.completed skip: clinic already has subscription", {
      clinicId: clinic.id,
      existingSubscriptionId: clinic.stripe_subscription_id,
    });
    return;
  }

  // Crear Subscription en Stripe ---------------------------------
  const stripe = getStripe();

  // Solo pasamos trial_end si está en el futuro. Si trial_ends_at
  // es null o ya venció, omitimos el campo y Stripe inicia la
  // suscripción en estado active (cobro inmediato). Esto evita
  // cobros sorpresa si el estado en BD está inconsistente.
  const nowUnix = Math.floor(Date.now() / 1000);
  const candidateTrialEnd = clinic.trial_ends_at
    ? Math.floor(new Date(clinic.trial_ends_at).getTime() / 1000)
    : null;
  const trialEndUnix =
    candidateTrialEnd && candidateTrialEnd > nowUnix
      ? candidateTrialEnd
      : undefined;

  if (clinic.trial_ends_at && !trialEndUnix) {
    logEvent(event, "trial_ends_at in the past — starting active subscription", {
      clinicId: clinic.id,
      trialEndsAt: clinic.trial_ends_at,
    });
  }

  const subscription = await stripe.subscriptions.create(
    {
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      trial_end: trialEndUnix,
      metadata: {
        clinic_id: clinic.id,
        clinic_slug: clinic.slug,
        interval,
      },
    },
    { idempotencyKey: session.id },
  );

  logEvent(event, "subscription created from checkout.session.completed", {
    clinicId: clinic.id,
    subscriptionId: subscription.id,
    trialEnd: subscription.trial_end,
  });

  // Guardar stripe_subscription_id en clinics -------------------
  const { error: updateError } = await supabaseAdmin
    .from("clinics")
    .update({ stripe_subscription_id: subscription.id })
    .eq("id", clinic.id);

  if (updateError) {
    console.error(
      "[stripe-webhook] failed to save subscription_id after setup_intent",
      {
        clinicId: clinic.id,
        subscriptionId: subscription.id,
        error: updateError.message,
      },
    );
    // Re-throw: garantiza que el outer catch borre el claim de
    // stripe_events_processed y Stripe reintente el webhook entero.
    // Así el email "Tarjeta añadida" solo sale cuando BD ha persistido
    // stripe_subscription_id. La idempotencyKey en subscriptions.create
    // (session.id) evita que el reintento duplique la subscription en Stripe.
    throw new Error(
      `Failed to persist stripe_subscription_id: ${updateError.message}`,
    );
  }

  // Enviar email "tarjeta añadida correctamente" -----------------
  try {
    const ownerEmail = await getClinicOwnerEmail(event, clinic.id);
    if (!ownerEmail) return;

    // Leer importe + interval del Price de Stripe (sin hardcode 19/190)
    const priceObj = await getStripe().prices.retrieve(priceId);
    const amountLabel = formatAmount(
      priceObj.unit_amount ?? 0,
      priceObj.currency ?? "eur",
    );
    const planLabel = buildPlanLabel(priceId, priceObj.recurring?.interval);

    await sendPaymentMethodAddedEmail({
      toEmail: ownerEmail,
      clinicName: clinic.name,
      trialEndsAt: clinic.trial_ends_at ?? new Date().toISOString(),
      amountLabel,
      planLabel,
    });

    logEvent(event, "payment_method_added email sent", {
      clinicId: clinic.id,
      toEmail: ownerEmail,
    });
  } catch (err) {
    console.error("[stripe-webhook] payment_method_added email failed", {
      clinicId: clinic.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // No re-throw: el email no es bloqueante para el flow.
  }
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

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(event, session);
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
