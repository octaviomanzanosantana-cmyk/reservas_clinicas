import {
  ClinicAccessError,
  requireCurrentClinicForApi,
} from "@/lib/clinicAuth";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type ClinicForReactivate = {
  id: string;
  name: string;
  subscription_status: string;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
  is_pilot: boolean;
};

/**
 * Sprint 6 — Reactivación de suscripción
 *
 * POST /api/billing/reactivate
 *
 * Operación inversa a /api/billing/cancel: marca la suscripción
 * Stripe con cancel_at_period_end=false. El webhook
 * customer.subscription.updated se encarga de devolver la BD a
 * subscription_status='active' y resetear canceled_at (B7).
 *
 * Idempotente: si la subscription ya tenía
 * cancel_at_period_end=false, devuelve 200 sin llamar update.
 */
export async function POST() {
  try {
    // Auth ----------------------------------------------------------
    const access = await requireCurrentClinicForApi();

    // Cargar clínica ------------------------------------------------
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select(
        "id, name, subscription_status, stripe_subscription_id, plan_expires_at, is_pilot",
      )
      .eq("id", access.clinicId)
      .maybeSingle<ClinicForReactivate>();

    if (!clinic) {
      return NextResponse.json(
        { error: "Clínica no encontrada" },
        { status: 404 },
      );
    }

    // Guards de negocio --------------------------------------------
    if (clinic.is_pilot) {
      return NextResponse.json(
        {
          error: "Las clínicas piloto no necesitan reactivar suscripción",
        },
        { status: 403 },
      );
    }

    if (!clinic.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No hay suscripción que reactivar" },
        { status: 400 },
      );
    }

    if (clinic.subscription_status !== "canceled") {
      return NextResponse.json(
        {
          error: "La suscripción no está cancelada, no requiere reactivación",
        },
        { status: 400 },
      );
    }

    // Defensa: si el periodo ya venció, Stripe está a punto de
    // emitir subscription.deleted (o ya lo hizo) y la subscription
    // dejará de ser reactivable. Mejor rechazar y orientar al
    // usuario a re-suscribirse desde checkout.
    if (
      clinic.plan_expires_at &&
      new Date(clinic.plan_expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "El periodo de suscripción ya ha expirado, no se puede reactivar. Suscríbete de nuevo desde tu plan.",
        },
        { status: 400 },
      );
    }

    // Stripe -------------------------------------------------------
    const stripe = getStripe();

    // Idempotencia: si la subscription ya estaba activa (sin marca
    // de cancelación), devolver OK sin llamar update.
    const current = await stripe.subscriptions.retrieve(
      clinic.stripe_subscription_id,
    );

    if (current.cancel_at_period_end === false) {
      console.info(
        "[api/billing/reactivate] already active (idempotent)",
        { clinicId: clinic.id },
      );
      return NextResponse.json({
        ok: true,
        already_active: true,
        plan_expires_at: clinic.plan_expires_at,
      });
    }

    const updated = await stripe.subscriptions.update(
      clinic.stripe_subscription_id,
      { cancel_at_period_end: false },
    );

    // current_period_end vive en items.data[0] en API
    // 2026-03-25.dahlia (mismo patrón que cancel/route.ts y
    // webhook/route.ts).
    const item = updated.items.data[0];
    const endUnix = item?.current_period_end ?? null;
    const endsAtIso = endUnix
      ? new Date(endUnix * 1000).toISOString()
      : clinic.plan_expires_at;

    return NextResponse.json({
      ok: true,
      already_active: false,
      plan_expires_at: endsAtIso,
    });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/billing/reactivate] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "No se pudo reactivar la suscripción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
