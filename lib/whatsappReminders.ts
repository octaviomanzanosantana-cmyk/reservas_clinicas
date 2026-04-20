import "server-only";

import { buildAppointmentShareMessage } from "@/lib/appointmentShareMessage";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TomorrowAppointment = {
  id: number;
  token: string;
  patient_name: string;
  patient_phone: string | null;
  service_name: string;
  modality: "presencial" | "online";
  appointment_type: string | null;
  scheduled_at: string;
  video_link: string | null;
  whatsapp_reminder_sent_at: string | null;
};

export type ClinicWithTomorrowAppointments = {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  clinic_address: string | null;
  notification_email: string;
  timezone: string;
  notify_on_whatsapp_reminder: boolean;
  appointments: TomorrowAppointment[];
};

type AppointmentDbRow = {
  id: number;
  token: string;
  clinic_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  service: string;
  modality: string | null;
  appointment_type: string | null;
  scheduled_at: string | null;
  video_link: string | null;
  whatsapp_reminder_sent_at: string | null;
  status: string;
};

type ClinicDbRow = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  notification_email: string | null;
  timezone: string | null;
  notify_on_whatsapp_reminder: boolean;
};

function normalizeModality(raw: string | null): "presencial" | "online" {
  return raw === "online" ? "online" : "presencial";
}

function mapRowToTomorrowAppointment(row: AppointmentDbRow): TomorrowAppointment {
  return {
    id: row.id,
    token: row.token,
    patient_name: row.patient_name,
    patient_phone: row.patient_phone,
    service_name: row.service,
    modality: normalizeModality(row.modality),
    appointment_type: row.appointment_type ?? null,
    scheduled_at: row.scheduled_at ?? "",
    video_link: row.video_link,
    whatsapp_reminder_sent_at: row.whatsapp_reminder_sent_at,
  };
}

/**
 * Calcula el rango UTC que cubre "mañana" en una timezone dada.
 * Usado por el cron y por `getTomorrowRemindersData`.
 */
function tomorrowRangeInTimezone(timezone: string): { startUtc: string; endUtc: string } {
  const now = new Date();
  // Formatear en la TZ local para obtener "hoy" en esa TZ
  const tzFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayLocal = tzFormatter.format(now); // YYYY-MM-DD
  const [y, m, d] = todayLocal.split("-").map((s) => Number.parseInt(s, 10));

  // "Mañana" local = hoy local + 1 día
  const tomorrowLocalDate = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1));
  const yy = tomorrowLocalDate.getUTCFullYear();
  const mm = String(tomorrowLocalDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(tomorrowLocalDate.getUTCDate()).padStart(2, "0");

  // Convertimos "00:00 hora local de la TZ" a UTC
  const startLocalIso = `${yy}-${mm}-${dd}T00:00:00`;
  const endLocalIso = `${yy}-${mm}-${dd}T23:59:59.999`;

  return {
    startUtc: localIsoToUtc(startLocalIso, timezone),
    endUtc: localIsoToUtc(endLocalIso, timezone),
  };
}

function localIsoToUtc(localIso: string, timezone: string): string {
  // Trick: construir un Date como si fuera UTC y comparar con el formateado en TZ
  const asUtc = new Date(`${localIso}Z`);
  const inTz = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(asUtc);
  const get = (type: string) => Number(inTz.find((p) => p.type === type)?.value ?? 0);
  const tzDate = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")),
  );
  const diff = tzDate.getTime() - asUtc.getTime();
  return new Date(asUtc.getTime() - diff).toISOString();
}

/**
 * Devuelve los datos necesarios del email matinal para TODAS las clínicas
 * con el toggle activado. El caller (cron) filtra después por "hora local = 9:00".
 */
export async function getTomorrowRemindersData(): Promise<ClinicWithTomorrowAppointments[]> {
  const { data: clinics, error: clinicsError } = await supabaseAdmin
    .from("clinics")
    .select("id, slug, name, address, notification_email, timezone, notify_on_whatsapp_reminder")
    .eq("notify_on_whatsapp_reminder", true);

  if (clinicsError) throw new Error(clinicsError.message);

  const result: ClinicWithTomorrowAppointments[] = [];

  for (const clinic of (clinics ?? []) as ClinicDbRow[]) {
    const timezone = clinic.timezone?.trim() || "Atlantic/Canary";
    const notificationEmail = clinic.notification_email?.trim();
    if (!notificationEmail) continue;

    const { startUtc, endUtc } = tomorrowRangeInTimezone(timezone);

    const { data: appts, error: apptsError } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, token, clinic_id, patient_name, patient_phone, service, modality, appointment_type, scheduled_at, video_link, whatsapp_reminder_sent_at, status",
      )
      .eq("clinic_id", clinic.id)
      .neq("status", "cancelled")
      .not("patient_phone", "is", null)
      .gte("scheduled_at", startUtc)
      .lte("scheduled_at", endUtc)
      .order("scheduled_at", { ascending: true });

    if (apptsError) throw new Error(apptsError.message);

    const appointments = ((appts ?? []) as AppointmentDbRow[]).map(mapRowToTomorrowAppointment);
    if (appointments.length === 0) continue;

    result.push({
      clinic_id: clinic.id,
      clinic_name: clinic.name,
      clinic_slug: clinic.slug,
      clinic_address: clinic.address,
      notification_email: notificationEmail,
      timezone,
      notify_on_whatsapp_reminder: clinic.notify_on_whatsapp_reminder,
      appointments,
    });
  }

  return result;
}

/**
 * Citas próximas (hoy/mañana/pasado) con teléfono, para el panel de recordatorios.
 * Ventana: desde ahora hasta +72h.
 */
export async function getUpcomingReminders(clinicId: string): Promise<TomorrowAppointment[]> {
  const safeId = clinicId.trim();
  if (!safeId) return [];

  const now = new Date();
  const horizon = new Date(now.getTime() + 72 * 3_600_000);

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, token, clinic_id, patient_name, patient_phone, service, modality, appointment_type, scheduled_at, video_link, whatsapp_reminder_sent_at, status",
    )
    .eq("clinic_id", safeId)
    .neq("status", "cancelled")
    .not("patient_phone", "is", null)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as AppointmentDbRow[]).map(mapRowToTomorrowAppointment);
}

export async function markReminderSent(appointmentId: number, clinicId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("appointments")
    .update({ whatsapp_reminder_sent_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId.trim());
  if (error) throw new Error(error.message);
}

export async function unmarkReminderSent(appointmentId: number, clinicId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("appointments")
    .update({ whatsapp_reminder_sent_at: null })
    .eq("id", appointmentId)
    .eq("clinic_id", clinicId.trim());
  if (error) throw new Error(error.message);
}

/**
 * Reset nocturno: borra marcas de citas pasadas para que el panel del
 * día siguiente empiece limpio.
 */
export async function resetPastReminders(): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .update({ whatsapp_reminder_sent_at: null })
    .lt("scheduled_at", now)
    .not("whatsapp_reminder_sent_at", "is", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/**
 * Construye link directo a WhatsApp.
 * - Normaliza el teléfono (quita espacios, guiones, paréntesis, puntos)
 * - Si no empieza por "+", asume España (+34)
 *
 * Usa api.whatsapp.com/send (NO wa.me) porque wa.me hace un redirect
 * server-side que re-encoda el parámetro `text` con form-urlencoded y
 * corrompe multi-byte UTF-8 (emojis 4 bytes → %EF%BF%BD U+FFFD).
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  let raw = (phone ?? "").replace(/[\s\-().]/g, "");
  if (!raw.startsWith("+")) {
    raw = `+34${raw}`;
  }
  const digits = raw.replace(/[^\d]/g, "");
  const encoded = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encoded}`;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatDateLabelInTimezone(startTime: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(startTime);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";

  const wd = (weekday || WEEKDAYS[startTime.getDay()]).replace(/^./, (c) => c.toUpperCase());
  const mn = month || MONTHS[startTime.getMonth()];
  const hhmm = `${hour}:${minute}`;

  return `${wd} ${day} de ${mn} a las ${hhmm}`;
}

/**
 * Plantilla del mensaje de recordatorio (WhatsApp).
 * Delega en `buildAppointmentShareMessage` con kind="reminder" para compartir
 * estructura con el botón "Compartir" del dashboard (kind="confirmation"):
 * saludo + servicio + fecha + ubicación/enlace video + link autogestión /a/<token>.
 */
export function buildReminderMessage(params: {
  patientName: string;
  clinicName: string;
  clinicAddress: string | null;
  serviceName: string;
  startTime: Date;
  modality: "presencial" | "online";
  videoLink: string | null;
  appointmentToken: string;
  appUrl: string;
  timezone: string;
}): string {
  const dateLabel = formatDateLabelInTimezone(params.startTime, params.timezone);

  return buildAppointmentShareMessage({
    kind: "reminder",
    patientName: params.patientName,
    clinicName: params.clinicName,
    serviceName: params.serviceName,
    dateLabel,
    address: params.clinicAddress,
    modality: params.modality,
    videoLink: params.videoLink,
    appointmentToken: params.appointmentToken,
    appUrl: params.appUrl,
  });
}
