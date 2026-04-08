import "server-only";

import type { AppointmentRow } from "@/lib/appointments";
import { wrapEmailHtml } from "@/lib/emailLayout";

type AppointmentEmailCopy = {
  subject: string;
  intro: string;
  reviewUrl?: string | null;
};

type ClinicNotificationOptions = {
  notificationEmail?: string | null;
};

const LOGO_URL = "https://app.appoclick.com/logo_appoclick_transparent.png";
const BRAND_COLOR = "#0E9E82";

function getAppUrl(): string | null {
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  return appUrl ? appUrl.replace(/\/+$/, "") : null;
}

function getEmailConfig() {
  const apiKey = process.env.EMAIL_API_KEY?.trim() || "";
  const from = process.env.EMAIL_FROM?.trim() || "";
  const appUrl = getAppUrl();
  return { apiKey, from, appUrl };
}

async function sendEmail(params: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`Email send failed (${response.status}): ${responseText}`);
  }
}

function getModalityLabel(appointment: AppointmentRow): string {
  return appointment.modality === "online" ? "Online" : "Presencial";
}

function getTypeLabel(appointment: AppointmentRow): string {
  return appointment.appointment_type === "revision" ? "Revisión" : "Primera visita";
}

function buildDetailRows(appointment: AppointmentRow): string {
  const rows = [
    { label: "Servicio", value: appointment.service },
    { label: "Tipo", value: getTypeLabel(appointment) },
    { label: "Modalidad", value: getModalityLabel(appointment) },
    { label: "Fecha y hora", value: appointment.datetime_label },
  ];

  if (appointment.modality !== "online" && appointment.address) {
    rows.push({ label: "Dirección", value: appointment.address });
  }

  rows.push({ label: "Duración", value: appointment.duration_label });

  return rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 12px;color:#6B7280;font-size:13px;white-space:nowrap;vertical-align:top">${r.label}</td>
        <td style="padding:8px 12px;color:#1A1A1A;font-size:14px;font-weight:500">${r.value}</td>
      </tr>`,
    )
    .join("");
}

function buildHtmlEmail(params: {
  appointment: AppointmentRow;
  intro: string;
  ctaUrl: string;
  ctaLabel: string;
  reviewUrl?: string | null;
  extraHtml?: string;
}): string {
  const { appointment, intro, ctaUrl, ctaLabel, reviewUrl, extraHtml } = params;

  const reviewBlock = reviewUrl
    ? `<p style="margin:20px 0 0;text-align:center"><a href="${reviewUrl}" style="color:${BRAND_COLOR};font-size:13px">¿Te ha gustado? Déjanos una reseña</a></p>`
    : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2F2F0;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #E5E7EB">

<!-- Logo -->
<tr><td align="center" style="background:${BRAND_COLOR};border-radius:14px 14px 0 0;height:80px;padding:0 24px">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
    <td style="vertical-align:middle;padding-right:12px">
      <div style="width:40px;height:40px;border-radius:50%;background:#ffffff;display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:40px">
        <svg viewBox="0 0 30 30" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M8 15.5L12.5 20L22 10" stroke="#0E9E82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </td>
    <td style="vertical-align:middle">
      <span style="color:#ffffff;font-size:22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.01em">AppoClick</span>
    </td>
  </tr></table>
</td></tr>

<!-- Saludo -->
<tr><td style="padding:24px 28px 0">
  <p style="margin:0;font-size:16px;font-weight:600;color:#1A1A1A">Hola ${appointment.patient_name},</p>
  <p style="margin:8px 0 0;font-size:14px;color:#6B7280;line-height:1.5">${intro}</p>
</td></tr>

<!-- Datos de la cita -->
<tr><td style="padding:20px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F0;border-radius:10px">
    <tr><td style="padding:4px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td colspan="2" style="padding:12px 12px 4px;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em">${appointment.clinic_name}</td>
        </tr>
        ${buildDetailRows(appointment)}
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- CTA -->
<tr><td align="center" style="padding:4px 28px 8px">
  <a href="${ctaUrl}" style="display:inline-block;padding:12px 32px;background:${BRAND_COLOR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px">${ctaLabel}</a>
</td></tr>

${extraHtml ? `<tr><td style="padding:0 28px 8px">${extraHtml}</td></tr>` : ""}
${reviewBlock ? `<tr><td style="padding:0 28px 8px">${reviewBlock}</td></tr>` : ""}

<!-- Pie -->
<tr><td style="padding:20px 28px;border-top:1px solid #E5E7EB">
  <p style="margin:0;font-size:12px;color:#6B7280;text-align:center">${appointment.clinic_name}${appointment.address ? ` · ${appointment.address}` : ""}</p>
  <p style="margin:6px 0 0;font-size:11px;color:#9CA3AF;text-align:center">Enviado con <a href="https://appoclick.com" style="color:#9CA3AF">Appoclick</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim();
}

function buildPlainText(params: {
  appointment: AppointmentRow;
  intro: string;
  ctaUrl: string;
  reviewUrl?: string | null;
}): string {
  const { appointment, intro, ctaUrl, reviewUrl } = params;
  const lines = [
    `Hola ${appointment.patient_name},`,
    "",
    intro,
    "",
    `Clínica: ${appointment.clinic_name}`,
    `Servicio: ${appointment.service}`,
    `Tipo: ${getTypeLabel(appointment)}`,
    `Modalidad: ${getModalityLabel(appointment)}`,
    `Fecha y hora: ${appointment.datetime_label}`,
  ];

  if (appointment.modality !== "online" && appointment.address) {
    lines.push(`Dirección: ${appointment.address}`);
  }
  lines.push(`Duración: ${appointment.duration_label}`);
  lines.push("", `Gestionar cita: ${ctaUrl}`);

  if (reviewUrl) {
    lines.push("", `Déjanos una reseña: ${reviewUrl}`);
  }

  return lines.join("\n");
}

async function sendAppointmentEmail(
  appointment: AppointmentRow,
  copy: AppointmentEmailCopy,
  options?: ClinicNotificationOptions,
): Promise<void> {
  const patientEmail = appointment.patient_email?.trim();
  const { apiKey, from, appUrl } = getEmailConfig();

  if (!patientEmail) return;

  if (!apiKey || !from || !appUrl) {
    console.warn("[appointments.email] Missing email configuration", {
      hasEmailApiKey: Boolean(apiKey),
      hasEmailFrom: Boolean(from),
      hasAppUrl: Boolean(appUrl),
      appointmentToken: appointment.token,
    });
    return;
  }

  const appointmentLink = `${appUrl}/a/${appointment.token}`;

  const text = buildPlainText({
    appointment,
    intro: copy.intro,
    ctaUrl: appointmentLink,
    reviewUrl: copy.reviewUrl,
  });

  const html = buildHtmlEmail({
    appointment,
    intro: copy.intro,
    ctaUrl: appointmentLink,
    ctaLabel: "Gestionar mi cita",
    reviewUrl: copy.reviewUrl,
  });

  await sendEmail({ apiKey, from, to: [patientEmail], subject: copy.subject, text, html });

  // Copia a la clínica
  const clinicEmail = options?.notificationEmail?.trim();
  if (clinicEmail) {
    try {
      await sendEmail({
        apiKey,
        from,
        to: [clinicEmail],
        subject: `[Copia] ${copy.subject}`,
        text: `Copia de notificación enviada a ${patientEmail}:\n\n${text}`,
        html: `<div style="font-family:Arial,sans-serif;color:#6B7280;font-size:13px;padding:12px 16px;background:#F2F2F0;border-radius:10px;margin-bottom:16px">Copia de notificación enviada a ${patientEmail}</div>${html}`,
      });
    } catch (error) {
      console.error("[appointments.email] Failed to send clinic copy", {
        clinicEmail,
        appointmentToken: appointment.token,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function sendAppointmentCreatedEmail(
  appointment: AppointmentRow,
  options?: ClinicNotificationOptions & { reviewUrl?: string | null },
): Promise<void> {
  await sendAppointmentEmail(
    appointment,
    {
      subject: `Tu cita en ${appointment.clinic_name}`,
      intro: "Tu cita ha sido registrada correctamente. Aqui tienes los detalles.",
      reviewUrl: options?.reviewUrl,
    },
    options,
  );
}

export async function sendAppointmentRescheduledEmail(
  appointment: AppointmentRow,
  options?: ClinicNotificationOptions,
): Promise<void> {
  await sendAppointmentEmail(
    appointment,
    {
      subject: `Cita modificada en ${appointment.clinic_name}`,
      intro: "Tu cita ha sido reprogramada. Este es tu nuevo horario.",
    },
    options,
  );
}

export async function sendAppointmentReminderEmail(
  appointment: AppointmentRow,
  options?: ClinicNotificationOptions & { reviewUrl?: string | null },
): Promise<void> {
  await sendAppointmentEmail(
    appointment,
    {
      subject: `Recordatorio: tu cita en ${appointment.clinic_name}`,
      intro: "Te recordamos que tienes una cita programada pronto.",
      reviewUrl: options?.reviewUrl,
    },
    options,
  );
}

export async function sendAppointmentCancelledEmail(
  appointment: AppointmentRow,
  options?: ClinicNotificationOptions & { bookingUrl?: string | null },
): Promise<void> {
  const patientEmail = appointment.patient_email?.trim();
  const { apiKey, from, appUrl } = getEmailConfig();

  if (!patientEmail || !apiKey || !from || !appUrl) return;

  const bookingUrl = options?.bookingUrl ?? appUrl;

  const text = buildPlainText({
    appointment,
    intro: "Tu cita ha sido cancelada. Aquí tienes el resumen.",
    ctaUrl: bookingUrl,
  });

  const html = buildHtmlEmail({
    appointment,
    intro: "Tu cita ha sido cancelada correctamente. Si necesitas una nueva cita, puedes reservar desde el enlace.",
    ctaUrl: bookingUrl,
    ctaLabel: "Reservar nueva cita",
  });

  await sendEmail({ apiKey, from, to: [patientEmail], subject: `Tu cita en ${appointment.clinic_name} ha sido cancelada`, text, html });

  const clinicEmail = options?.notificationEmail?.trim();
  if (clinicEmail) {
    try {
      await sendEmail({
        apiKey,
        from,
        to: [clinicEmail],
        subject: `[Cancelación] Cita cancelada — ${appointment.patient_name}`,
        text: `Cita cancelada por ${appointment.patient_name}:\n\n${text}`,
        html: `<div style="font-family:Arial,sans-serif;color:#6B7280;font-size:13px;padding:12px 16px;background:#F2F2F0;border-radius:10px;margin-bottom:16px">Cita cancelada por ${appointment.patient_name}</div>${html}`,
      });
    } catch (error) {
      console.error("[appointments.email] Failed to send clinic cancellation copy", {
        clinicEmail,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export async function sendAppointmentReviewEmail(
  appointment: AppointmentRow,
  reviewUrl: string,
): Promise<void> {
  const patientEmail = appointment.patient_email?.trim();
  const { apiKey, from, appUrl } = getEmailConfig();

  if (!patientEmail || !apiKey || !from || !appUrl) return;

  const text = [
    `Hola ${appointment.patient_name},`,
    "",
    `Nos alegra que hayas podido venir a tu cita en ${appointment.clinic_name}.`,
    "",
    `Tu opinión ayuda a ${appointment.clinic_name} a seguir mejorando y a otros pacientes a tomar mejores decisiones.`,
    "",
    "Solo tarda 30 segundos.",
    "",
    `Dejar mi opinión: ${reviewUrl}`,
    "",
    `Gracias por confiar en ${appointment.clinic_name}`,
  ].join("\n");

  const html = buildHtmlEmail({
    appointment,
    intro: `Nos alegra que hayas podido venir a tu cita en ${appointment.clinic_name}. Tu opinión ayuda a ${appointment.clinic_name} a seguir mejorando y a otros pacientes a tomar mejores decisiones. Solo tarda 30 segundos.`,
    ctaUrl: reviewUrl,
    ctaLabel: "Dejar mi opinión →",
    extraHtml: `<p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9CA3AF">Gracias por confiar en ${appointment.clinic_name}</p>`,
  });

  await sendEmail({
    apiKey,
    from,
    to: [patientEmail],
    subject: `¿Cómo fue tu consulta con ${appointment.clinic_name}?`,
    text,
    html,
  });
}

/**
 * Email de bienvenida.
 * invited=true  → flujo admin: botón "Crear mi contraseña" con passwordResetUrl
 * invited=false → flujo autoservicio: solo info, sin botón de activación
 */
export async function sendClinicWelcomeEmail(
  email: string,
  clinicName: string,
  options?: { invited?: boolean; passwordResetUrl?: string },
): Promise<void> {
  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    console.warn("[clinic.welcome] Missing email configuration");
    return;
  }

  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.appoclick.com";
  const isInvited = options?.invited ?? false;
  const loginUrl = `${appUrl.replace(/\/+$/, "")}/login`;

  const subject = isInvited
    ? `Bienvenido/a a Appoclick — Crea tu contraseña`
    : `¡Bienvenido/a a Appoclick!`;

  const ctaUrl = isInvited ? (options?.passwordResetUrl ?? loginUrl) : loginUrl;
  const ctaLabel = isInvited ? "Crear mi contraseña" : "Acceder a mi panel";
  const introText = isInvited
    ? `Tu clínica "${clinicName}" ya está lista en Appoclick. Crea tu contraseña para acceder a tu panel.`
    : `Tu clínica "${clinicName}" ya está lista en Appoclick. Accede cuando quieras.`;

  const text = [
    `¡Bienvenido/a a Appoclick!`,
    "",
    introText,
    "",
    `${isInvited ? "Crea tu contraseña" : "Accede a tu panel"}: ${ctaUrl}`,
    "",
    `Una vez dentro, podrás:`,
    `- Gestionar tus citas desde el panel`,
    `- Compartir tu página de reservas con tus pacientes`,
    `- Configurar servicios, horarios y notificaciones`,
    "",
    `¿Necesitas ayuda? Escríbenos a hola@appoclick.com`,
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2F2F0;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F0">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #E5E7EB">

<!-- Logo -->
<tr><td align="center" style="background:${BRAND_COLOR};border-radius:14px 14px 0 0;height:80px;padding:0 24px">
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
    <td style="vertical-align:middle;padding-right:12px">
      <div style="width:40px;height:40px;border-radius:50%;background:#ffffff;display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:40px">
        <svg viewBox="0 0 30 30" fill="none" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M8 15.5L12.5 20L22 10" stroke="#0E9E82" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </td>
    <td style="vertical-align:middle">
      <span style="color:#ffffff;font-size:22px;font-weight:700;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.01em">AppoClick</span>
    </td>
  </tr></table>
</td></tr>

<!-- Bienvenida -->
<tr><td style="padding:24px 28px 0">
  <h1 style="margin:0;font-size:22px;font-weight:700;color:#1A1A1A;text-align:center">¡Bienvenido/a a Appoclick!</h1>
  <p style="margin:12px 0 0;font-size:14px;color:#6B7280;line-height:1.6;text-align:center">
    Tu clínica <strong style="color:#1A1A1A">${clinicName}</strong> ya está lista.
    ${isInvited ? "Crea tu contraseña para empezar." : "Accede cuando quieras desde tu panel."}
  </p>
</td></tr>

<!-- CTA -->
<tr><td align="center" style="padding:24px 28px">
  <a href="${ctaUrl}" style="display:inline-block;padding:14px 36px;background:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px">${ctaLabel}</a>
</td></tr>

<!-- Qué puedes hacer -->
<tr><td style="padding:0 28px 20px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F0;border-radius:10px">
    <tr><td style="padding:16px">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1A1A1A">Una vez dentro podrás:</p>
      <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.8">
        ✓ Gestionar tus citas desde el panel<br/>
        ✓ Compartir tu página de reservas con pacientes<br/>
        ✓ Configurar servicios, horarios y notificaciones
      </p>
    </td></tr>
  </table>
</td></tr>

<!-- Pie -->
<tr><td style="padding:20px 28px;border-top:1px solid #E5E7EB">
  <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center">
    ¿Necesitas ayuda? <a href="mailto:hola@appoclick.com" style="color:${BRAND_COLOR}">hola@appoclick.com</a>
  </p>
  <p style="margin:8px 0 0;font-size:11px;color:#9CA3AF;text-align:center">
    Appoclick · ANALÓGICAMENTE DIGITALES, S.L.
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`.trim();

  await sendEmail({ apiKey, from, to: [email], subject, text, html });
}
