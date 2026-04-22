import "server-only";

import { buildCtaButton, wrapEmailHtml } from "@/lib/emailLayout";

type TrialEmailParams = {
  toEmail: string;
  toName: string;
  clinicName: string;
};

const BASE_URL =
  process.env.APP_URL
  ?? process.env.NEXT_PUBLIC_APP_URL
  ?? "https://app.appoclick.com";

const MI_PLAN_URL = `${BASE_URL}/mi-plan`;

const P_STYLE = "margin:0 0 16px;font-size:15px;color:#1A1A1A;line-height:1.6;";

function getEmailConfig() {
  return {
    apiKey: process.env.EMAIL_API_KEY?.trim() || "",
    from: process.env.EMAIL_FROM?.trim() || "",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Email send failed (${response.status}): ${text}`);
  }
}

// ============================================================================
// Email #2 · Aviso 5 días (día 10 del trial)
// ============================================================================

function build5DaysHtml(params: TrialEmailParams): string {
  const name = escapeHtml(params.toName);
  const clinic = escapeHtml(params.clinicName);
  const body = `
    <p style="${P_STYLE}">Hola ${name},</p>
    <p style="${P_STYLE}">
      Llevas 10 días usando Appoclick en tu clínica <strong>${clinic}</strong>. Te quedan 5 días antes de que termine tu prueba gratuita.
    </p>
    <p style="${P_STYLE}">
      Cuando se acabe, si no has añadido un método de pago, tu cuenta pasará al plan <strong>Free</strong> automáticamente. Tus datos, tus servicios y tus citas se quedan contigo — no se borra nada. Pero perderás los recordatorios automáticos, los avisos por WhatsApp y algunas funciones más del plan Starter.
    </p>
    <p style="${P_STYLE}">
      Para seguir sin interrupciones, añade tu tarjeta cuando quieras:
    </p>
    ${buildCtaButton("Añadir método de pago", MI_PLAN_URL)}
    <p style="${P_STYLE}">
      Si tienes dudas, escríbenos a hola@appoclick.com y te echamos una mano.
    </p>
  `;
  return wrapEmailHtml(body);
}

function build5DaysText(params: TrialEmailParams): string {
  return [
    `Hola ${params.toName},`,
    "",
    `Llevas 10 días usando Appoclick en tu clínica ${params.clinicName}. Te quedan 5 días antes de que termine tu prueba gratuita.`,
    "",
    "Cuando se acabe, si no has añadido un método de pago, tu cuenta pasará al plan Free automáticamente. Tus datos, tus servicios y tus citas se quedan contigo — no se borra nada. Pero perderás los recordatorios automáticos, los avisos por WhatsApp y algunas funciones más del plan Starter.",
    "",
    "Para seguir sin interrupciones, añade tu tarjeta cuando quieras:",
    "",
    `Añadir método de pago: ${MI_PLAN_URL}`,
    "",
    "Si tienes dudas, escríbenos a hola@appoclick.com y te echamos una mano.",
  ].join("\n");
}

export async function sendTrial5DaysEmail(params: TrialEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  await sendEmail({
    apiKey,
    from,
    to: params.toEmail,
    subject: "Te quedan 5 días de prueba en Appoclick",
    html: build5DaysHtml(params),
    text: build5DaysText(params),
  });
}

// ============================================================================
// Email #3 · Aviso 24 horas (día 14 del trial)
// ============================================================================

function build24HoursHtml(params: TrialEmailParams): string {
  const name = escapeHtml(params.toName);
  const body = `
    <p style="${P_STYLE}">Hola ${name},</p>
    <p style="${P_STYLE}">
      Mañana termina tu prueba gratuita de 15 días. Queremos que sepas cómo va a ir para que no te pille por sorpresa.
    </p>
    <p style="${P_STYLE}">
      <strong>Si añades tarjeta hoy</strong>, mañana se activa tu plan Starter (19 €/mes) y sigues como hasta ahora, con todas las funciones.
    </p>
    <p style="${P_STYLE}">
      <strong>Si no añades nada</strong>, tu cuenta pasa al plan Free. Tus datos siguen aquí, pero se desactivan los recordatorios al paciente, los avisos por WhatsApp y el email matinal.
    </p>
    ${buildCtaButton("Añadir método de pago", MI_PLAN_URL)}
    <p style="${P_STYLE}">
      Si decides quedarte en Free, no tienes que hacer nada. Y si en el futuro quieres volver a Starter, está siempre disponible desde tu panel.
    </p>
  `;
  return wrapEmailHtml(body);
}

function build24HoursText(params: TrialEmailParams): string {
  return [
    `Hola ${params.toName},`,
    "",
    "Mañana termina tu prueba gratuita de 15 días. Queremos que sepas cómo va a ir para que no te pille por sorpresa.",
    "",
    "Si añades tarjeta hoy, mañana se activa tu plan Starter (19 €/mes) y sigues como hasta ahora, con todas las funciones.",
    "",
    "Si no añades nada, tu cuenta pasa al plan Free. Tus datos siguen aquí, pero se desactivan los recordatorios al paciente, los avisos por WhatsApp y el email matinal.",
    "",
    `Añadir método de pago: ${MI_PLAN_URL}`,
    "",
    "Si decides quedarte en Free, no tienes que hacer nada. Y si en el futuro quieres volver a Starter, está siempre disponible desde tu panel.",
  ].join("\n");
}

export async function sendTrial24HoursEmail(params: TrialEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  await sendEmail({
    apiKey,
    from,
    to: params.toEmail,
    subject: "Tu prueba en Appoclick termina mañana",
    html: build24HoursHtml(params),
    text: build24HoursText(params),
  });
}

// ============================================================================
// Email #4 · Trial expirado (día 15 · downgrade a Free)
// ============================================================================

function buildExpiredHtml(params: TrialEmailParams): string {
  const name = escapeHtml(params.toName);
  const body = `
    <p style="${P_STYLE}">Hola ${name},</p>
    <p style="${P_STYLE}">
      Tu prueba gratuita de Appoclick ha terminado y hemos pasado tu cuenta al plan <strong>Free</strong>.
    </p>
    <p style="${P_STYLE}">
      Tus datos están intactos: tus servicios, tus citas, tus pacientes, tu enlace de reservas. Todo sigue donde lo dejaste.
    </p>
    <p style="${P_STYLE}">
      En Free sigues pudiendo recibir hasta 50 citas al mes con 1 servicio. Lo que se desactiva son los recordatorios automáticos, los avisos por WhatsApp y el email matinal.
    </p>
    <p style="${P_STYLE}">
      Si quieres recuperar todo eso, puedes reactivar Starter cuando quieras por 19 €/mes:
    </p>
    ${buildCtaButton("Reactivar mi plan", MI_PLAN_URL)}
    <p style="${P_STYLE}">
      Gracias por haber probado Appoclick. Estamos aquí si necesitas cualquier cosa.
    </p>
  `;
  return wrapEmailHtml(body);
}

function buildExpiredText(params: TrialEmailParams): string {
  return [
    `Hola ${params.toName},`,
    "",
    "Tu prueba gratuita de Appoclick ha terminado y hemos pasado tu cuenta al plan Free.",
    "",
    "Tus datos están intactos: tus servicios, tus citas, tus pacientes, tu enlace de reservas. Todo sigue donde lo dejaste.",
    "",
    "En Free sigues pudiendo recibir hasta 50 citas al mes con 1 servicio. Lo que se desactiva son los recordatorios automáticos, los avisos por WhatsApp y el email matinal.",
    "",
    "Si quieres recuperar todo eso, puedes reactivar Starter cuando quieras por 19 €/mes:",
    "",
    `Reactivar mi plan: ${MI_PLAN_URL}`,
    "",
    "Gracias por haber probado Appoclick. Estamos aquí si necesitas cualquier cosa.",
  ].join("\n");
}

export async function sendTrialExpiredEmail(params: TrialEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  await sendEmail({
    apiKey,
    from,
    to: params.toEmail,
    subject: "Tu prueba ha terminado — estás en el plan Free",
    html: buildExpiredHtml(params),
    text: buildExpiredText(params),
  });
}

// ============================================================================
// Email #1 · Bienvenida + trial iniciado (día 0, tras confirmar email)
// ============================================================================

const UL_STYLE = "margin:0 0 16px;padding-left:20px;";
const LI_STYLE = "margin:0 0 8px;font-size:15px;color:#1A1A1A;line-height:1.6;";

function buildWelcomeTrialStartedHtml(params: TrialEmailParams): string {
  const name = escapeHtml(params.toName);
  const clinic = escapeHtml(params.clinicName);
  const body = `
    <p style="${P_STYLE}">Hola ${name},</p>
    <p style="${P_STYLE}">
      Tu email está confirmado y tu cuenta de <strong>${clinic}</strong> ya está activa en Appoclick.
    </p>
    <p style="${P_STYLE}">
      Tienes <strong>15 días de prueba gratuita</strong> con todas las funciones del plan Starter. Durante este tiempo puedes:
    </p>
    <ul style="${UL_STYLE}">
      <li style="${LI_STYLE}">Recibir reservas online desde tu enlace personal (pégalo en tu web, Instagram o WhatsApp).</li>
      <li style="${LI_STYLE}">Enviar recordatorios automáticos a tus pacientes por email y WhatsApp.</li>
      <li style="${LI_STYLE}">Sincronizar tu agenda con Google Calendar.</li>
    </ul>
    <p style="${P_STYLE}">
      No tienes que añadir tarjeta durante la prueba. Pasados los 15 días, si no has añadido método de pago, tu cuenta pasará al plan Free automáticamente — sin cobros, sin sorpresas.
    </p>
    ${buildCtaButton("Empezar a usar Appoclick", BASE_URL)}
    <p style="${P_STYLE}">
      Si te atascas con algo, escríbenos a hola@appoclick.com. Te respondemos rápido.
    </p>
  `;
  return wrapEmailHtml(body);
}

function buildWelcomeTrialStartedText(params: TrialEmailParams): string {
  return [
    `Hola ${params.toName},`,
    "",
    `Tu email está confirmado y tu cuenta de ${params.clinicName} ya está activa en Appoclick.`,
    "",
    "Tienes 15 días de prueba gratuita con todas las funciones del plan Starter. Durante este tiempo puedes:",
    "",
    "- Recibir reservas online desde tu enlace personal (pégalo en tu web, Instagram o WhatsApp).",
    "- Enviar recordatorios automáticos a tus pacientes por email y WhatsApp.",
    "- Sincronizar tu agenda con Google Calendar.",
    "",
    "No tienes que añadir tarjeta durante la prueba. Pasados los 15 días, si no has añadido método de pago, tu cuenta pasará al plan Free automáticamente — sin cobros, sin sorpresas.",
    "",
    `Empezar a usar Appoclick: ${BASE_URL}`,
    "",
    "Si te atascas con algo, escríbenos a hola@appoclick.com. Te respondemos rápido.",
  ].join("\n");
}

export async function sendWelcomeTrialStartedEmail(params: TrialEmailParams): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    throw new Error("EMAIL_API_KEY o EMAIL_FROM sin configurar");
  }

  await sendEmail({
    apiKey,
    from,
    to: params.toEmail,
    subject: "Bienvenido a Appoclick — tu prueba de 15 días empieza ahora",
    html: buildWelcomeTrialStartedHtml(params),
    text: buildWelcomeTrialStartedText(params),
  });
}
