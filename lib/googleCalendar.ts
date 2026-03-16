import "server-only";

import type { BusyRange } from "@/lib/availability";
import type { AppointmentRow } from "@/lib/appointments";
import { getClinicById, getClinicBySlug, updateClinicBySlug } from "@/lib/clinics";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { google } from "googleapis";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];
const DEFAULT_TIMEZONE = "Europe/Madrid";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    getRequiredEnv("GOOGLE_CLIENT_ID"),
    getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    getRequiredEnv("GOOGLE_REDIRECT_URI"),
  );
}

function getFallbackClinicSlug(): string {
  return PANEL_CLINIC_SLUG;
}

function resolveDateTimeFromLabel(label: string): { start: Date; end: Date } {
  const fallbackStart = new Date();
  fallbackStart.setHours(fallbackStart.getHours() + 1, 0, 0, 0);
  const fallbackEnd = new Date(fallbackStart.getTime() + 30 * 60 * 1000);

  const parts = label.split("·").map((part) => part.trim());
  if (parts.length < 2) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const timeMatch = parts[1].match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return { start, end };
}

async function getClinicGoogleConfig(clinicSlug?: string | null) {
  const resolvedSlug = clinicSlug?.trim() || getFallbackClinicSlug();
  const clinic = await getClinicBySlug(resolvedSlug);

  if (!clinic) {
    throw new Error("Clínica no encontrada");
  }

  return clinic;
}

async function getAuthorizedOAuthClient(clinicSlug?: string | null) {
  const clinic = await getClinicGoogleConfig(clinicSlug);

  if (!clinic.google_connected || !clinic.google_refresh_token) {
    throw new Error("Google Calendar no autorizado para esta clínica.");
  }

  const client = getOAuthClient();

  client.on("tokens", async (tokens) => {
    if (!clinic.slug) return;

    await updateClinicBySlug(clinic.slug, {
      google_connected: true,
      google_refresh_token: tokens.refresh_token ?? clinic.google_refresh_token,
      google_calendar_id: clinic.google_calendar_id ?? "primary",
      google_email: clinic.google_email,
    });
  });

  client.setCredentials({
    refresh_token: clinic.google_refresh_token,
  });

  return { client, clinic };
}

function parseGoogleEventDate(value?: string | null): Date | null {
  if (!value) return null;

  const allDayMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (allDayMatch) {
    const year = Number.parseInt(allDayMatch[1], 10);
    const monthIndex = Number.parseInt(allDayMatch[2], 10) - 1;
    const day = Number.parseInt(allDayMatch[3], 10);
    const date = new Date(year, monthIndex, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveEventDateRange(appointment: AppointmentRow): { start: Date; end: Date } {
  const startFromSchedule = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
  const hasValidSchedule = Boolean(startFromSchedule && !Number.isNaN(startFromSchedule.getTime()));
  const start = hasValidSchedule
    ? (startFromSchedule as Date)
    : resolveDateTimeFromLabel(appointment.datetime_label).start;

  const durationMinutes = Number.parseInt(appointment.duration_label, 10);
  const safeDuration = Number.isNaN(durationMinutes) ? 30 : Math.max(15, durationMinutes);
  const end = new Date(start.getTime() + safeDuration * 60 * 1000);
  return { start, end };
}

export async function isGoogleCalendarAuthorized(clinicSlug?: string | null): Promise<boolean> {
  const clinic = await getClinicGoogleConfig(clinicSlug);
  return Boolean(clinic.google_connected && clinic.google_refresh_token);
}

export async function getGoogleCalendarAuthUrl(clinicSlug?: string | null): Promise<string> {
  const resolvedSlug = clinicSlug?.trim() || getFallbackClinicSlug();
  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: resolvedSlug,
  });
}

export async function completeGoogleCalendarOAuth(code: string, clinicSlug: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  await updateClinicBySlug(clinicSlug, {
    google_connected: true,
    google_email: profile.email ?? null,
    google_refresh_token: tokens.refresh_token ?? null,
    google_calendar_id: "primary",
  });
}

export async function disconnectGoogleCalendar(clinicSlug?: string | null): Promise<void> {
  const clinic = await getClinicGoogleConfig(clinicSlug);

  await updateClinicBySlug(clinic.slug, {
    google_connected: false,
    google_email: null,
    google_refresh_token: null,
    google_calendar_id: null,
  });
}

export async function getGoogleCalendarBusyRangesForDate(
  date: Date,
  clinicSlug?: string | null,
  calendarId?: string | null,
): Promise<BusyRange[]> {
  const clinic = await getClinicGoogleConfig(clinicSlug);
  if (!clinic.google_connected || !clinic.google_refresh_token) {
    return [];
  }

  const { client } = await getAuthorizedOAuthClient(clinic.slug);
  const calendar = google.calendar({ version: "v3", auth: client });
  const resolvedCalendarId = calendarId || clinic.google_calendar_id || "primary";

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data } = await calendar.events.list({
    calendarId: resolvedCalendarId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return (data.items ?? [])
    .filter((event) => event.status !== "cancelled")
    .filter((event) => event.transparency !== "transparent")
    .map((event) => {
      const start = parseGoogleEventDate(event.start?.dateTime ?? event.start?.date);
      const end = parseGoogleEventDate(event.end?.dateTime ?? event.end?.date);

      if (!start || !end) return null;

      const clampedStart = new Date(Math.max(start.getTime(), startOfDay.getTime()));
      const clampedEnd = new Date(Math.min(end.getTime(), endOfDay.getTime()));

      if (clampedEnd <= clampedStart) return null;

      return { start: clampedStart, end: clampedEnd };
    })
    .filter((item): item is BusyRange => Boolean(item));
}

export async function createCalendarEvent(
  appointment: AppointmentRow,
  clinicSlug?: string | null,
): Promise<{
  eventId: string;
  calendarId: string;
}> {
  const clinic =
    clinicSlug?.trim()
      ? await getClinicBySlug(clinicSlug)
      : appointment.clinic_id
        ? await getClinicById(appointment.clinic_id)
        : null;

  if (!clinic?.google_connected || !clinic.google_refresh_token) {
    throw new Error("Google Calendar no conectado para esta clínica.");
  }

  const { client } = await getAuthorizedOAuthClient(clinic.slug);
  const calendar = google.calendar({ version: "v3", auth: client });
  const calendarId = clinic.google_calendar_id || "primary";
  const { start, end } = resolveEventDateRange(appointment);
  const summary = `${appointment.service} - ${appointment.patient_name}`;
  const description = [
    `Paciente: ${appointment.patient_name}`,
    `Clínica: ${appointment.clinic_name}`,
    `Token: ${appointment.token}`,
  ].join("\n");

  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      },
    },
  });

  if (!data.id) {
    throw new Error("No se pudo obtener el ID del evento de Google Calendar.");
  }

  return {
    eventId: data.id,
    calendarId,
  };
}

export async function deleteCalendarEvent(
  eventId: string,
  calendarId?: string | null,
  clinicSlug?: string | null,
  clinicId?: string | null,
): Promise<void> {
  const clinic =
    clinicSlug?.trim()
      ? await getClinicBySlug(clinicSlug)
      : clinicId?.trim()
        ? await getClinicById(clinicId)
        : await getClinicGoogleConfig(clinicSlug);
  if (!clinic.google_connected || !clinic.google_refresh_token) {
    return;
  }

  const { client } = await getAuthorizedOAuthClient(clinic.slug);
  const calendar = google.calendar({ version: "v3", auth: client });
  const resolvedCalendarId = calendarId || clinic.google_calendar_id || "primary";

  try {
    await calendar.events.delete({
      calendarId: resolvedCalendarId,
      eventId,
    });
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "number"
        ? (error as { code: number }).code
        : null;

    if (status === 404 || status === 410) {
      return;
    }
    throw error;
  }
}

export async function updateCalendarEvent(
  appointment: AppointmentRow,
  eventId: string,
  calendarId?: string | null,
  clinicSlug?: string | null,
): Promise<void> {
  const clinic =
    clinicSlug?.trim()
      ? await getClinicBySlug(clinicSlug)
      : appointment.clinic_id
        ? await getClinicById(appointment.clinic_id)
        : null;

  if (!clinic?.google_connected || !clinic.google_refresh_token) {
    return;
  }

  const { client } = await getAuthorizedOAuthClient(clinic.slug);
  const calendar = google.calendar({ version: "v3", auth: client });
  const resolvedCalendarId = calendarId || clinic.google_calendar_id || "primary";
  const { start, end } = resolveEventDateRange(appointment);

  const summary = `✅ Confirmada - ${appointment.service} - ${appointment.patient_name}`;
  const description = [
    `Estado: CONFIRMADA`,
    `Paciente confirmó la cita desde el enlace`,
    ``,
    `Paciente: ${appointment.patient_name}`,
    `Clínica: ${appointment.clinic_name}`,
    `Token: ${appointment.token}`,
  ].join("\n");

  await calendar.events.patch({
    calendarId: resolvedCalendarId,
    eventId,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: DEFAULT_TIMEZONE,
      },
    },
  });
}
