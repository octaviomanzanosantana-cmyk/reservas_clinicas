import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getStripe,
  PLAN_PRICES,
  type StripeInterval,
  type StripePlan,
} from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const access = await requireCurrentClinicForApi();
    const body = (await request.json()) as {
      planId?: string;
      interval?: string;
    };

    const { planId, interval } = body;

    if (!planId || !interval) {
      return NextResponse.json(
        { error: "planId e interval son obligatorios" },
        { status: 400 },
      );
    }

    const VALID_PLANS = new Set<StripePlan>(["starter", "pro"]);
    const VALID_INTERVALS = new Set<StripeInterval>(["monthly", "yearly"]);

    if (!VALID_PLANS.has(planId as StripePlan)) {
      return NextResponse.json(
        { error: "Plan no válido" },
        { status: 400 },
      );
    }
    if (!VALID_INTERVALS.has(interval as StripeInterval)) {
      return NextResponse.json(
        { error: "Intervalo no válido" },
        { status: 400 },
      );
    }

    const typedPlanId = planId as StripePlan;
    const typedInterval = interval as StripeInterval;
    const priceId = PLAN_PRICES[typedPlanId][typedInterval];
    if (!priceId) {
      return NextResponse.json(
        { error: `Precio no configurado para ${typedPlanId}/${typedInterval}` },
        { status: 400 },
      );
    }

    // Fetch clinic data
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("id, slug, name, stripe_customer_id")
      .eq("id", access.clinicId)
      .single();

    if (clinicError || !clinic) {
      return NextResponse.json(
        { error: "Clínica no encontrada" },
        { status: 404 },
      );
    }

    const stripe = getStripe();

    // Create or reuse Stripe customer
    let customerId = clinic.stripe_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          clinic_id: clinic.id,
          clinic_slug: clinic.slug,
        },
        name: clinic.name,
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("clinics")
        .update({ stripe_customer_id: customerId })
        .eq("id", clinic.id);
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/clinic/${clinic.slug}/settings?upgraded=true`,
      cancel_url: `${appUrl}/clinic/${clinic.slug}/settings`,
      metadata: {
        clinic_id: clinic.id,
        clinic_slug: clinic.slug,
        plan_id: typedPlanId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear checkout";
    const status =
      error instanceof Error && "status" in error
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
