import "server-only";

import { buildCtaButton, wrapEmailHtml } from "./emailLayout";
import { sendEmail } from "./sendEmail";

/**
 * Emails transaccionales de billing.
 *
 * Se disparan desde:
 * - setup_intent.succeeded → sendPaymentMethodAddedEmail.
 * - invoice.payment_succeeded → sendPaymentSucceededEmail.
 * - invoice.payment_failed → sendPaymentFailedEmail.
 *
 * Patrón idéntico a lib/trialEmails.ts:
 * - getEmailConfig local (lee EMAIL_API_KEY + EMAIL_FROM).
 * - MI_PLAN_URL para CTAs.
 * - wrapEmailHtml + buildCtaButton para layout consistente.
 * - sendEmail compartido para fetch a Resend.
 */

const BASE_URL =
  process.env.APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://app.appoclick.com";

const MI_PLAN_URL = `${BASE_URL}/mi-plan`;

function getEmailConfig() {
  return {
    apiKey: process.env.EMAIL_API_KEY?.trim() || "",
    from: process.env.EMAIL_FROM?.trim() || "",
  };
}

/**
 * Formatea una fecha ISO a "8 de mayo de 2026" en castellano.
 * Usa zona horaria Europe/Madrid (todas las clínicas son ES por
 * ahora — ajustar cuando haya clientes UE fuera).
 */
function formatDateES(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Madrid",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Email #1: tarjeta añadida correctamente
// ---------------------------------------------------------------------------

export async function sendPaymentMethodAddedEmail(params: {
  toEmail: string;
  toName: string;
  clinicName: string;
  trialEndsAt: string; // ISO
  amountLabel: string; // p.ej. "19 €" o "190 €"
  planLabel: string;   // p.ej. "Starter mensual" o "Starter anual"
}): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  const firstChargeDate = formatDateES(params.trialEndsAt);
  const subject = "Tarjeta añadida correctamente";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1A1A;">
      Hola ${params.toName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1A1A1A;">
      Tu tarjeta está registrada en Appoclick. Todavía no hemos cobrado nada.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1A1A1A;">
      Tu primer cobro será el <strong>${firstChargeDate}</strong> por
      <strong>${params.amountLabel}</strong> (${params.planLabel}).
      Sigues teniendo acceso completo a ${params.clinicName} mientras
      dura tu prueba.
    </p>
    ${buildCtaButton("Ver mi plan", MI_PLAN_URL)}
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280;">
      Si cambias de opinión antes del primer cobro, puedes cancelar desde
      tu panel en cualquier momento.
    </p>
  `;

  const text = `Hola ${params.toName},

Tu tarjeta está registrada en Appoclick. Todavía no hemos cobrado nada.

Tu primer cobro será el ${firstChargeDate} por ${params.amountLabel} (${params.planLabel}). Sigues teniendo acceso completo a ${params.clinicName} mientras dura tu prueba.

Ver mi plan: ${MI_PLAN_URL}

Si cambias de opinión antes del primer cobro, puedes cancelar desde tu panel en cualquier momento.`;

  await sendEmail({
    apiKey,
    from,
    to: [params.toEmail],
    subject,
    html: wrapEmailHtml(bodyHtml),
    text,
  });
}

// ---------------------------------------------------------------------------
// Email #2: cobro exitoso
// ---------------------------------------------------------------------------

export async function sendPaymentSucceededEmail(params: {
  toEmail: string;
  toName: string;
  clinicName: string;
  amountLabel: string;    // p.ej. "19 €"
  planLabel: string;      // p.ej. "Starter mensual"
  nextChargeAt: string;   // ISO del próximo cobro
}): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  const nextChargeDate = formatDateES(params.nextChargeAt);
  const subject = `Cobro procesado · ${params.planLabel} · ${params.amountLabel}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1A1A;">
      Hola ${params.toName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1A1A1A;">
      Hemos cobrado <strong>${params.amountLabel}</strong> por tu suscripción
      ${params.planLabel} a ${params.clinicName}. Todo en orden.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1A1A1A;">
      Tu próximo cobro será el <strong>${nextChargeDate}</strong>.
    </p>
    ${buildCtaButton("Ver comprobante y mi plan", MI_PLAN_URL)}
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280;">
      Recibirás la factura oficial por separado en los próximos días.
    </p>
  `;

  const text = `Hola ${params.toName},

Hemos cobrado ${params.amountLabel} por tu suscripción ${params.planLabel} a ${params.clinicName}. Todo en orden.

Tu próximo cobro será el ${nextChargeDate}.

Ver comprobante y mi plan: ${MI_PLAN_URL}

Recibirás la factura oficial por separado en los próximos días.`;

  await sendEmail({
    apiKey,
    from,
    to: [params.toEmail],
    subject,
    html: wrapEmailHtml(bodyHtml),
    text,
  });
}

// ---------------------------------------------------------------------------
// Email #3: cobro fallido
// ---------------------------------------------------------------------------

export async function sendPaymentFailedEmail(params: {
  toEmail: string;
  toName: string;
  clinicName: string;
  amountLabel: string;  // p.ej. "19 €"
}): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  const subject = "No hemos podido cobrar tu suscripción — revisa tu tarjeta";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1A1A;">
      Hola ${params.toName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1A1A1A;">
      El cobro de <strong>${params.amountLabel}</strong> de ${params.clinicName}
      no se ha podido procesar. Puede deberse a saldo insuficiente, fecha de
      caducidad o un bloqueo puntual del banco.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1A1A1A;">
      Stripe volverá a intentarlo automáticamente en los próximos días. Para
      evitar interrupciones, puedes actualizar tu tarjeta ahora.
    </p>
    ${buildCtaButton("Actualizar método de pago", MI_PLAN_URL)}
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6B7280;">
      Mientras tanto, tu cuenta sigue activa. Si necesitas ayuda, responde a
      este email o escribe a hola@appoclick.com.
    </p>
  `;

  const text = `Hola ${params.toName},

El cobro de ${params.amountLabel} de ${params.clinicName} no se ha podido procesar. Puede deberse a saldo insuficiente, fecha de caducidad o un bloqueo puntual del banco.

Stripe volverá a intentarlo automáticamente en los próximos días. Para evitar interrupciones, puedes actualizar tu tarjeta ahora.

Actualizar método de pago: ${MI_PLAN_URL}

Mientras tanto, tu cuenta sigue activa. Si necesitas ayuda, responde a este email o escribe a hola@appoclick.com.`;

  await sendEmail({
    apiKey,
    from,
    to: [params.toEmail],
    subject,
    html: wrapEmailHtml(bodyHtml),
    text,
  });
}
