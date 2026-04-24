import "server-only";

import { wrapEmailHtml } from "@/lib/emailLayout";
import { sendEmail } from "./sendEmail";
import {
  buildReminderMessage,
  buildWhatsAppLink,
  getTomorrowRemindersData,
  type ClinicWithTomorrowAppointments,
  type TomorrowAppointment,
} from "@/lib/whatsappReminders";

// Sigue convención del proyecto: HTML-as-string con inline styles (ver
// lib/appointmentEmails.ts y lib/emailLayout.ts). No TSX.

type EmailConfig = {
  apiKey: string;
  from: string;
};

function getEmailConfig(): EmailConfig {
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

function formatTomorrowHeader(timezone: string): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3_600_000);
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(tomorrow);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const wd = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${wd} ${day} de ${month} de ${year}`;
}

function formatTime(iso: string, timezone: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function renderAppointmentCard(
  appointment: TomorrowAppointment,
  clinic: ClinicWithTomorrowAppointments,
  appUrl: string,
): string {
  const message = buildReminderMessage({
    patientName: appointment.patient_name,
    clinicName: clinic.clinic_name,
    clinicAddress: clinic.clinic_address,
    serviceName: appointment.service_name,
    startTime: new Date(appointment.scheduled_at),
    modality: appointment.modality,
    videoLink: appointment.video_link,
    appointmentToken: appointment.token,
    appUrl,
    timezone: clinic.timezone,
  });
  const waLink = buildWhatsAppLink(appointment.patient_phone ?? "", message);
  const time = formatTime(appointment.scheduled_at, clinic.timezone);
  const visitTypeLabel =
    appointment.appointment_type === "primera_visita"
      ? "Primera visita"
      : appointment.appointment_type === "revision"
        ? "Revisión"
        : null;

  const modalityLabel = appointment.modality === "online" ? "Online" : "Presencial";

  const videoRow = appointment.video_link
    ? `<tr><td style="padding-top:6px;font-size:13px;color:#6B7280;">Enlace: <a href="${escapeHtml(appointment.video_link)}" style="color:#0E9E82;text-decoration:underline;">${escapeHtml(appointment.video_link)}</a></td></tr>`
    : "";

  const visitTypeRow = visitTypeLabel
    ? `<tr><td style="padding-top:2px;font-size:13px;color:#6B7280;">${escapeHtml(visitTypeLabel)}</td></tr>`
    : "";

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;background-color:#FAFAFA;border:1px solid #E5E7EB;border-radius:10px;">
    <tr>
      <td style="padding:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:15px;font-weight:700;color:#1A1A1A;">
              ${escapeHtml(time)} · ${escapeHtml(appointment.patient_name)}
            </td>
          </tr>
          <tr>
            <td style="padding-top:4px;font-size:13px;color:#6B7280;">
              ${escapeHtml(appointment.service_name)} · ${modalityLabel}
            </td>
          </tr>
          ${visitTypeRow}
          <tr>
            <td style="padding-top:2px;font-size:13px;color:#6B7280;">
              Tel: ${escapeHtml(appointment.patient_phone ?? "")}
            </td>
          </tr>
          ${videoRow}
          <tr>
            <td style="padding-top:14px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#25D366;border-radius:10px;">
                    <a href="${escapeHtml(waLink)}"
                       style="display:inline-block;padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;"
                       target="_blank" rel="noopener noreferrer">
                      Enviar por WhatsApp →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function renderEmailHtml(
  clinic: ClinicWithTomorrowAppointments,
  panelUrl: string,
  appUrl: string,
): string {
  const header = formatTomorrowHeader(clinic.timezone);
  const count = clinic.appointments.length;
  const countLabel = count === 1 ? "1 cita" : `${count} citas`;

  const cards = clinic.appointments
    .map((a) => renderAppointmentCard(a, clinic, appUrl))
    .join("\n");

  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1A1A1A;">Recordatorios para mañana</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6B7280;">${escapeHtml(header)} · ${countLabel}</p>
    <p style="margin:0 0 24px;font-size:14px;color:#1A1A1A;">Pulsa "Enviar por WhatsApp" junto a cada cita para mandar el recordatorio con un toque.</p>

    ${cards}

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #E5E7EB;">
      <p style="margin:0 0 8px;font-size:14px;color:#1A1A1A;">¿Prefieres gestionarlas desde el panel?</p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(panelUrl)}" style="color:#0E9E82;font-weight:600;text-decoration:underline;">Ver recordatorios en el panel →</a>
      </p>
      <p style="margin:0 0 10px;font-size:12px;color:#9CA3AF;">
        Si un paciente no tiene teléfono no aparece en la lista. Puedes añadirlo desde la ficha de la cita.
      </p>
      <p style="margin:0;font-size:12px;color:#9CA3AF;">
        ¿No quieres recibir este email? Desactívalo en Perfil → Notificaciones.
      </p>
    </div>
  `;

  return wrapEmailHtml(body);
}

function renderEmailText(clinic: ClinicWithTomorrowAppointments, appUrl: string): string {
  const header = formatTomorrowHeader(clinic.timezone);
  const lines: string[] = [
    "Recordatorios para mañana",
    `${header} · ${clinic.appointments.length} cita(s)`,
    "",
    "Pulsa el enlace junto a cada cita para enviar el recordatorio por WhatsApp.",
    "",
  ];
  for (const a of clinic.appointments) {
    const message = buildReminderMessage({
      patientName: a.patient_name,
      clinicName: clinic.clinic_name,
      clinicAddress: clinic.clinic_address,
      serviceName: a.service_name,
      startTime: new Date(a.scheduled_at),
      modality: a.modality,
      videoLink: a.video_link,
      appointmentToken: a.token,
      appUrl,
      timezone: clinic.timezone,
    });
    const waLink = buildWhatsAppLink(a.patient_phone ?? "", message);
    const time = formatTime(a.scheduled_at, clinic.timezone);
    const modalityLabel = a.modality === "online" ? "Online" : "Presencial";
    lines.push(
      `• ${time} — ${a.patient_name} (${a.service_name} · ${modalityLabel})`,
      `  Tel: ${a.patient_phone ?? ""}`,
      `  WhatsApp: ${waLink}`,
      "",
    );
  }
  lines.push("— AppoClick");
  return lines.join("\n");
}

/**
 * Determina si la hora actual en la timezone de la clínica es "09" (es decir,
 * el cron cubre 9:00–9:59 local). Se ejecuta en UTC pero filtra por cada TZ.
 */
export function isSendHourInTimezone(timezone: string, now: Date = new Date()): boolean {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const h = Number.parseInt(hour, 10);
  return h === 9;
}

export type DailySendResult = {
  clinicsProcessed: number;
  emailsSent: number;
  skipped: number;
  errors: Array<{ clinic_id: string; error: string }>;
};

export async function sendDailyWhatsAppReminders(
  opts: { force?: boolean } = {},
): Promise<DailySendResult> {
  const result: DailySendResult = {
    clinicsProcessed: 0,
    emailsSent: 0,
    skipped: 0,
    errors: [],
  };

  const { apiKey, from } = getEmailConfig();
  if (!apiKey || !from) {
    result.errors.push({ clinic_id: "-", error: "EMAIL_API_KEY o EMAIL_FROM sin configurar" });
    return result;
  }

  const clinics = await getTomorrowRemindersData();
  const appUrlBase =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://app.appoclick.com";
  const appUrl = appUrlBase.replace(/\/+$/, "");

  for (const clinic of clinics) {
    result.clinicsProcessed += 1;

    // Cron diario (0 7 * * *) en Vercel Hobby: no filtramos por hora local,
    // enviamos a toda clínica con toggle ON y citas mañana. opts.force
    // mantenido por compatibilidad si se reactiva el filtro horario.
    if (clinic.appointments.length === 0) {
      result.skipped += 1;
      continue;
    }

    try {
      const panelUrl = `${appUrl}/clinic/${clinic.clinic_slug}/reminders`;
      const html = renderEmailHtml(clinic, panelUrl, appUrl);
      const text = renderEmailText(clinic, appUrl);
      const subject = `Recordatorios para mañana · ${clinic.appointments.length} cita${
        clinic.appointments.length === 1 ? "" : "s"
      }`;

      await sendEmail({
        apiKey,
        from,
        to: [clinic.notification_email],
        subject,
        html,
        text,
      });
      result.emailsSent += 1;
    } catch (err) {
      result.errors.push({
        clinic_id: clinic.clinic_id,
        error: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  return result;
}
