import "server-only";

import type { AppointmentRow } from "@/lib/appointments";

type AppointmentEmailCopy = {
  subject: string;
  intro: string;
};

function getAppUrl(): string | null {
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
  return appUrl ? appUrl.replace(/\/+$/, "") : null;
}

async function sendAppointmentEmail(
  appointment: AppointmentRow,
  copy: AppointmentEmailCopy,
): Promise<void> {
  const patientEmail = appointment.patient_email?.trim();
  const apiKey = process.env.EMAIL_API_KEY?.trim() || "";
  const from = process.env.EMAIL_FROM?.trim() || "";
  const appUrl = getAppUrl();

  if (!patientEmail) {
    return;
  }

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

  const text = [
    `Hola ${appointment.patient_name},`,
    "",
    copy.intro,
    `Clinica: ${appointment.clinic_name}`,
    `Servicio: ${appointment.service}`,
    `Fecha y hora: ${appointment.datetime_label}`,
    "",
    `Gestionar cita: ${appointmentLink}`,
    `Confirmar: ${confirmLink}`,
    `Cambiar: ${rescheduleLink}`,
    `Cancelar: ${cancelLink}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hola ${appointment.patient_name},</p>
      <p>${copy.intro}</p>
      <ul>
        <li><strong>Clinica:</strong> ${appointment.clinic_name}</li>
        <li><strong>Servicio:</strong> ${appointment.service}</li>
        <li><strong>Fecha y hora:</strong> ${appointment.datetime_label}</li>
      </ul>
      <p><a href="${appointmentLink}">Gestionar cita</a></p>
      <p>
        <a href="${confirmLink}">Confirmar</a><br />
        <a href="${rescheduleLink}">Cambiar</a><br />
        <a href="${cancelLink}">Cancelar</a>
      </p>
    </div>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [patientEmail],
      subject: copy.subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    console.error("[appointments.email] Provider request failed", {
      status: response.status,
      responseText,
      appointmentToken: appointment.token,
    });
    throw new Error(`No se pudo enviar el email de la cita (${response.status})`);
  }
}

export async function sendAppointmentCreatedEmail(appointment: AppointmentRow): Promise<void> {
  await sendAppointmentEmail(appointment, {
    subject: `Tu cita en ${appointment.clinic_name}`,
    intro: "Tu cita ha sido creada correctamente.",
  });
}

export async function sendAppointmentRescheduledEmail(appointment: AppointmentRow): Promise<void> {
  await sendAppointmentEmail(appointment, {
    subject: `Tu cita ha sido modificada en ${appointment.clinic_name}`,
    intro: "Tu cita ha sido modificada. Este es tu nuevo horario.",
  });
}
