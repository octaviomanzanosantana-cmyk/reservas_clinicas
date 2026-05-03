import {
  ClinicAccessError,
  requireCurrentClinicForApi,
} from "@/lib/clinicAuth";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type ClinicForPortal = {
  id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const APP_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://app.appoclick.com";

/**
 * Sprint 4 — Customer Portal
 *
 * Crea una sesión del Stripe Customer Portal para que la clínica
 * autenticada pueda gestionar su método de pago y ver/descargar
 * facturas históricas. Devuelve la URL para redirigir.
 *
 * Limitaciones por configuración del Portal (Bloque 0):
 *   - NO permite cancelar suscripción (gestionado por Sprint 6 con feedback)
 *   - NO permite cambiar de plan ni pausar
 *   - Solo permite editar Nombre + Teléfono del cliente
 *
 * Visibilidad del botón en /mi-plan:
 *   - stripe_subscription_id IS NOT NULL
 *   - Excluye automáticamente pilots (siempre tienen NULL)
 *   - Excluye Free puro (no tienen suscripción Stripe)
 */
export async function POST() {
  try {
    // Auth ----------------------------------------------------------
    const access = await requireCurrentClinicForApi();

    // Leer customer + subscription IDs de la clínica ----------------
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("id", access.clinicId)
      .maybeSingle<ClinicForPortal>();

    if (!clinic) {
      return NextResponse.json(
        { error: "Clínica no encontrada" },
        { status: 404 },
      );
    }

    // Validar que tiene suscripción gestionable ---------------------
    if (!clinic.stripe_subscription_id || !clinic.stripe_customer_id) {
      return NextResponse.json(
        { error: "No tienes una suscripción activa para gestionar" },
        { status: 400 },
      );
    }

    // Crear sesión Customer Portal ----------------------------------
    // El cliente Stripe hereda automáticamente el modo (TEST/LIVE)
    // del helper getStripe() según la env var STRIPE_MODE.
    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: clinic.stripe_customer_id,
      return_url: `${APP_URL}/mi-plan`,
    });

    if (!session.url) {
      console.error(
        "[api/billing/portal] Stripe no devolvió URL de Portal",
      );
      return NextResponse.json(
        { error: "No se pudo abrir el portal. Inténtalo de nuevo." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/billing/portal] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "No se pudo abrir el portal. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
