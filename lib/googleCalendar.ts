import "server-only";

import type { BusyRange } from "@/lib/availability";
import { google } from "googleapis";
import type { AppointmentRow } from "@/lib/appointments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const DEFAULT_TIMEZONE = "Europe/Madrid";
const GOOGLE_TOKEN_ROW_ID = "default";

type GoogleOAuthTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
};

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

async function readStoredTokens() {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .select("access_token, refresh_token, scope, token_type, expiry_date")
    .eq("id", GOOGLE_TOKEN_ROW_ID)
    .maybeSingle<GoogleOAuthTokens>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

async function writeStoredTokens(tokens: unknown) {
  const nextTokens =
    typeof tokens === "object" && tokens !== null ? (tokens as GoogleOAuthTokens) : {};

  const payload = {
    id: GOOGLE_TOKEN_ROW_ID,
    access_token: nextTokens.access_token ?? null,
    refresh_token: nextTokens.refresh_token ?? null,
    scope: nextTokens.scope ?? null,
    token_type: nextTokens.token_type ?? null,
    expiry_date:
      typeof nextTokens.expiry_date === "number" ? Math.trunc(nextTokens.expiry_date) : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("google_calendar_tokens").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeWeekday(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function resolveDateTimeFromLabel(label: string): { start: Date; end: Date } {
  const fallbackStart = new Date();
  fallbackStart.setHours(fallbackStart.getHours() + 1, 0, 0, 0);
  const fallbackEnd = new Date(fallbackStart.getTime() + 30 * 60 * 1000);

  const parts = label.split("·").map((part) => part.trim());
  if (parts.length < 2) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const dayName = normalizeWeekday(parts[0]);
  const timeMatch = parts[1].match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const dayMap: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
  };

  const targetDay = dayMap[dayName];
  if (targetDay === undefined) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2], 10);
  const now = new Date();
  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);

  const delta = (targetDay - now.getDay() + 7) % 7;
  start.setDate(now.getDate() + delta);

  if (start <= now) {
    start.setDate(start.getDate() + 7);
  }

  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start, end };
}

export async function isGoogleCalendarAuthorized(): Promise<boolean> {
  const tokens = await readStoredTokens();
  return Boolean(tokens?.refresh_token || tokens?.access_token);
}

export async function getGoogleCalendarAuthUrl(): Promise<string> {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });
}

export async function completeGoogleCalendarOAuth(code: string): Promise<void> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  await writeStoredTokens(tokens);
}

async function getAuthorizedOAuthClient() {
  const client = getOAuthClient();
  const tokens = await readStoredTokens();

  if (!tokens) {
    throw new Error("Google Calendar no autorizado. Conecta la cuenta primero.");
  }

  client.on("tokens", async (nextTokens) => {
    const currentTokens = await readStoredTokens();
    await writeStoredTokens({
      ...currentTokens,
      ...nextTokens,
      refresh_token: nextTokens.refresh_token ?? currentTokens?.refresh_token ?? null,
    });
  });

  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });
  return client;
}

export async function getGoogleCalendarBusyRangesForDate(
  date: Date,
  calendarId?: string | null,
): Promise<BusyRange[]> {
  const auth = await getAuthorizedOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const resolvedCalendarId = calendarId || getRequiredEnv("GOOGLE_CALENDAR_ID");

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

export async function createCalendarEvent(appointment: AppointmentRow): Promise<{
  eventId: string;
  calendarId: string;
}> {
  const auth = await getAuthorizedOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = getRequiredEnv("GOOGLE_CALENDAR_ID");

  const startFromSchedule = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
  const hasValidSchedule = Boolean(startFromSchedule && !Number.isNaN(startFromSchedule.getTime()));
  const start = hasValidSchedule ? (startFromSchedule as Date) : resolveDateTimeFromLabel(appointment.datetime_label).start;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
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

export async function deleteCalendarEvent(eventId: string, calendarId?: string | null): Promise<void> {
  const auth = await getAuthorizedOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const resolvedCalendarId = calendarId || getRequiredEnv("GOOGLE_CALENDAR_ID");

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

    // Consider "not found/already deleted" as a successful terminal state.
    if (status === 404 || status === 410) {
      return;
    }
    throw error;
  }
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

export async function updateCalendarEvent(
  appointment: AppointmentRow,
  eventId: string,
  calendarId?: string | null,
): Promise<void> {
  const auth = await getAuthorizedOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const resolvedCalendarId = calendarId || getRequiredEnv("GOOGLE_CALENDAR_ID");
  const { start, end } = resolveEventDateRange(appointment);

  const summary = `✅ Confirmada – ${appointment.service} – ${appointment.patient_name}`;
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
