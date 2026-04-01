import "server-only";

import type { AppointmentRow } from "@/lib/appointments";

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

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1A1A1A; line-height: 1.6;">
      <p>Hola ${appointment.patient_name},</p>
      <p>${copy.intro}</p>
      <ul>
        <li><strong>Clinica:</strong> ${appointment.clinic_name}</li>
        <li><strong>Servicio:</strong> ${appointment.service}</li>
        <li><strong>Tipo:</strong> ${typeLabel}</li>
        <li><strong>Modalidad:</strong> ${modalityLabel}</li>
        <li><strong>Fecha y hora:</strong> ${appointment.datetime_label}</li>
      </ul>
      <p><a href="${appointmentLink}" style="color:#0E9E82">Gestionar cita</a></p>
      <p>
        <a href="${confirmLink}" style="color:#0E9E82">Confirmar</a><br />
        <a href="${rescheduleLink}" style="color:#0E9E82">Cambiar</a><br />
        <a href="${cancelLink}" style="color:#0E9E82">Cancelar</a>
      </p>
      ${reviewHtml}
    </div>
  `.trim();

  // Enviar al paciente
  await sendEmail({ apiKey, from, to: [patientEmail], subject: copy.subject, text, html });

  // Copia a la clínica si está configurado
  const clinicEmail = options?.notificationEmail?.trim();
  if (clinicEmail) {
    try {
      const clinicSubject = `[Copia] ${copy.subject}`;
      const clinicText = `Copia de notificacion enviada a ${patientEmail}:\n\n${text}`;
      const clinicHtml = `
        <div style="font-family: Arial, sans-serif; color: #6B7280; font-size: 13px; margin-bottom: 12px;">
          Copia de notificacion enviada a ${patientEmail}
        </div>
        ${html}
      `.trim();
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
