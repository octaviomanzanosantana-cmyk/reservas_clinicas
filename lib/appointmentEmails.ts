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
  const confirmLink = `${appointmentLink}/confirm`;
  const rescheduleLink = `${appointmentLink}/reschedule`;
  const cancelLink = `${appointmentLink}/cancel`;

  const reviewSection = copy.reviewUrl
    ? `\nTe ha gustado? Dejanos una resena: ${copy.reviewUrl}`
    : "";
  const reviewHtml = copy.reviewUrl
    ? `<p style="margin-top:16px"><a href="${copy.reviewUrl}" style="color:#0E9E82">Te ha gustado? Dejanos una resena</a></p>`
    : "";

  const modalityLabel = appointment.modality === "online" ? "Online" : "Presencial";
  const typeLabel = appointment.appointment_type === "revision" ? "Revision" : "Primera visita";

  const text = [
    `Hola ${appointment.patient_name},`,
    "",
    copy.intro,
    `Clinica: ${appointment.clinic_name}`,
    `Servicio: ${appointment.service}`,
    `Tipo: ${typeLabel}`,
    `Modalidad: ${modalityLabel}`,
    `Fecha y hora: ${appointment.datetime_label}`,
    "",
    `Gestionar cita: ${appointmentLink}`,
    `Confirmar: ${confirmLink}`,
    `Cambiar: ${rescheduleLink}`,
    `Cancelar: ${cancelLink}`,
    reviewSection,
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 8px">Hola <strong>${appointment.patient_name}</strong>,</p>
    <p style="margin:0 0 24px;color:#374151">${copy.intro}</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px;">
      <tr><td style="padding:20px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;width:120px;">Clínica</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${appointment.clinic_name}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Servicio</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${appointment.service}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Tipo</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Modalidad</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;">${modalityLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#6B7280;">Fecha y hora</td>
            <td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;">${appointment.datetime_label}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
      <tr>
        <td style="border-radius:8px;background-color:#0E9E82;">
          <a href="${appointmentLink}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
            Gestionar mi cita
          </a>
        </td>
      </tr>
    </table>

    <p style="font-size:13px;color:#6B7280;margin:0 0 4px">
      <a href="${confirmLink}" style="color:#0E9E82;text-decoration:none;">Confirmar cita</a>
      &nbsp;·&nbsp;
      <a href="${rescheduleLink}" style="color:#0E9E82;text-decoration:none;">Cambiar horario</a>
      &nbsp;·&nbsp;
      <a href="${cancelLink}" style="color:#0E9E82;text-decoration:none;">Cancelar</a>
    </p>
    ${reviewHtml}
  `;

  const html = wrapEmailHtml(bodyHtml);

  // Enviar al paciente
  await sendEmail({ apiKey, from, to: [patientEmail], subject: copy.subject, text, html });

  // Copia a la clínica si está configurado
  const clinicEmail = options?.notificationEmail?.trim();
  if (clinicEmail) {
    try {
      const clinicSubject = `[Copia] ${copy.subject}`;
      const clinicText = `Copia de notificacion enviada a ${patientEmail}:\n\n${text}`;
      const clinicHtml = wrapEmailHtml(`
        <p style="font-size:13px;color:#6B7280;margin:0 0 16px;padding:10px 14px;background:#F3F4F6;border-radius:6px;">
          Copia de notificación enviada a ${patientEmail}
        </p>
        ${bodyHtml}
      `);
      await sendEmail({ apiKey, from, to: [clinicEmail], subject: clinicSubject, text: clinicText, html: clinicHtml });
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
      intro: "Tu cita ha sido creada correctamente.",
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
      subject: `Tu cita ha sido modificada en ${appointment.clinic_name}`,
      intro: "Tu cita ha sido modificada. Este es tu nuevo horario.",
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
      subject: `Recordatorio: tu cita en ${appointment.clinic_name} es pronto`,
      intro: "Te recordamos que tienes una cita programada. Aqui tienes los detalles.",
      reviewUrl: options?.reviewUrl,
    },
    options,
  );
}
