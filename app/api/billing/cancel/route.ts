import {
  ClinicAccessError,
  requireCurrentClinicForApi,
} from "@/lib/clinicAuth";
import { sendCancellationRequestedEmail } from "@/lib/billingEmails";
import { isValidCancelReason } from "@/lib/billing/cancelReasons";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type ClinicForCancel = {
  id: string;
  name: string;
  plan: string | null;
  subscription_status: string;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
  is_pilot: boolean;
};

type CancelBody = Partial<{
  reason: unknown;
  reason_detail: unknown;
}>;

/**
 * Sprint 6 — Cancelación con feedback
 *
 * POST /api/billing/cancel
 * Body: { reason: CancelReason; reason_detail?: string }
 *
 * Marca la suscripción Stripe con cancel_at_period_end=true,
 * registra el feedback en subscription_cancellations y envía
 * el email #12 "cancelación recibida". El downgrade efectivo a
 * Free lo gestiona el webhook customer.subscription.deleted al
 * vencer el periodo (email #13).
 *
 * Idempotente: si la subscription ya tenía cancel_at_period_end=true,
 * devuelve 200 sin reinsertar feedback ni reenviar email.
 */
export async function POST(request: Request) {
  try {
    // Auth ----------------------------------------------------------
    const access = await requireCurrentClinicForApi();

    // Body ----------------------------------------------------------
    const body = (await request.json().catch(() => ({}))) as CancelBody;
    const reason = body.reason;
    const rawDetail = body.reason_detail;
    const reasonDetail =
      typeof rawDetail === "string" ? rawDetail.trim() : null;

    if (!isValidCancelReason(reason)) {
      return NextResponse.json(
        { error: "Razón inválida" },
        { status: 400 },
      );
    }

    if (reason === "other" && !reasonDetail) {
      return NextResponse.json(
        { error: "El motivo es obligatorio cuando seleccionas 'Otro'" },
        { status: 400 },
      );
    }

    if (reasonDetail && reasonDetail.length > 1000) {
      return NextResponse.json(
        { error: "El motivo no puede superar los 1000 caracteres" },
        { status: 400 },
      );
    }

    // Cargar clínica ------------------------------------------------
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select(
        "id, name, plan, subscription_status, stripe_subscription_id, plan_expires_at, is_pilot",
      )
      .eq("id", access.clinicId)
      .maybeSingle<ClinicForCancel>();

    if (!clinic) {
      return NextResponse.json(
        { error: "Clínica no encontrada" },
        { status: 404 },
      );
    }

    // Guards de negocio --------------------------------------------
    if (clinic.is_pilot) {
      return NextResponse.json(
        { error: "Las clínicas piloto no pueden cancelar suscripción" },
        { status: 403 },
      );
    }

    if (!clinic.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No hay suscripción activa que cancelar" },
        { status: 400 },
      );
    }

    if (
      clinic.subscription_status !== "active" &&
      clinic.subscription_status !== "trial"
    ) {
      return NextResponse.json(
        { error: "La suscripción no está en un estado cancelable" },
        { status: 400 },
      );
    }

    // Stripe -------------------------------------------------------
    const stripe = getStripe();

    // Idempotencia: si ya estaba marcada para cancelar, devolver OK
    // sin reinsertar feedback ni reenviar email.
    const current = await stripe.subscriptions.retrieve(
      clinic.stripe_subscription_id,
    );

    if (current.cancel_at_period_end) {
      console.info("[api/billing/cancel] already canceled (idempotent)", {
        clinicId: clinic.id,
      });
      return NextResponse.json({
        ok: true,
        already_canceled: true,
        plan_expires_at: clinic.plan_expires_at,
      });
    }

    const updated = await stripe.subscriptions.update(
      clinic.stripe_subscription_id,
      { cancel_at_period_end: true },
    );

    // Resolver fecha de fin de acceso: trial_end (si vigente) o
    // current_period_end del item. Mismo patrón que el webhook
    // handleSubscriptionCreatedOrUpdated — current_period_end vive
    // en items.data[0] en API 2026-03-25.dahlia, no en la
    // subscription directamente.
    const nowUnix = Math.floor(Date.now() / 1000);
    const item = updated.items.data[0];
    const endUnix =
      updated.trial_end && updated.trial_end > nowUnix
        ? updated.trial_end
        : (item?.current_period_end ?? null);

    const endsAtIso = endUnix
      ? new Date(endUnix * 1000).toISOString()
      : null;

    // INSERT subscription_cancellations (non-fatal: la fila es
    // analítica interna; Stripe es la fuente de verdad del estado).
    const { error: insertError } = await supabaseAdmin
      .from("subscription_cancellations")
      .insert({
        clinic_id: clinic.id,
        reason,
        reason_detail: reason === "other" ? reasonDetail : null,
        plan_at_cancel: clinic.plan,
      });

    if (insertError) {
      console.warn(
        "[api/billing/cancel] subscription_cancellations insert failed (non-fatal)",
        {
          clinicId: clinic.id,
          error: insertError.message,
        },
      );
    }

    // Email #12 (non-fatal) ----------------------------------------
    if (endsAtIso) {
      try {
        const { data: userRow } = await supabaseAdmin
          .from("clinic_users")
          .select("user_id")
          .eq("clinic_id", clinic.id)
          .maybeSingle<{ user_id: string }>();

        let toEmail: string | null = null;
        let toName = clinic.name;

        if (userRow?.user_id) {
          const { data: user } = await supabaseAdmin.auth.admin.getUserById(
            userRow.user_id,
          );
          toEmail = user?.user?.email ?? null;
          const metadata =
            (user?.user?.user_metadata ?? null) as
              | Record<string, unknown>
              | null;
          const rawFullName = metadata?.full_name;
          const fullName =
            typeof rawFullName === "string" ? rawFullName.trim() : "";
          if (fullName) {
            toName = fullName;
          }
        }

        if (toEmail) {
          await sendCancellationRequestedEmail({
            toEmail,
            toName,
            clinicName: clinic.name,
            endsAt: endsAtIso,
          });
        } else {
          console.warn(
            "[api/billing/cancel] owner email not resolved, skipping email",
            { clinicId: clinic.id },
          );
        }
      } catch (emailError) {
        console.warn(
          "[api/billing/cancel] email send failed (non-fatal)",
          {
            clinicId: clinic.id,
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          },
        );
      }
    } else {
      console.warn(
        "[api/billing/cancel] could not resolve end date — email skipped",
        {
          clinicId: clinic.id,
          subscriptionId: clinic.stripe_subscription_id,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      already_canceled: false,
      plan_expires_at: endsAtIso,
    });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[api/billing/cancel] unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "No se pudo cancelar la suscripción. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
