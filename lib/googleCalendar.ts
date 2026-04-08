import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
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

function signGoogleOAuthState(clinicId: string): string {
  return createHmac("sha256", getRequiredEnv("GOOGLE_CLIENT_SECRET"))
    .update(clinicId)
    .digest("hex");
}

function createGoogleOAuthState(clinicId: string): string {
  return Buffer.from(
    JSON.stringify({
      clinicId,
      sig: signGoogleOAuthState(clinicId),
    }),
  ).toString("base64url");
}

export function parseGoogleOAuthState(state: string): string {
  const decoded = Buffer.from(state, "base64url").toString("utf8");
  const payload = JSON.parse(decoded) as { clinicId?: string; sig?: string };
  const clinicId = payload.clinicId?.trim();
  const signature = payload.sig?.trim();

  if (!clinicId || !signature) {
    throw new Error("Estado OAuth inválido");
  }

  const expected = signGoogleOAuthState(clinicId);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Estado OAuth no válido");
  }

  return clinicId;
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

async function getClinicGoogleConfigById(clinicId: string) {
  const clinic = await getClinicById(clinicId.trim());

  if (!clinic) {
    throw new Error("Clínica no encontrada");
  }

  return clinic;
}

function buildGoogleCalendarAuthUrl(clinic: Awaited<ReturnType<typeof getClinicGoogleConfigById>>) {
  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    state: createGoogleOAuthState(clinic.id),
    ...(clinic.google_refresh_token ? {} : { prompt: "consent" }),
  });
}

async function getAuthorizedOAuthClient(clinicSlug?: string | null) {
  const clinic = await getClinicGoogleConfig(clinicSlug);

  if (!clinic.google_connected || !clinic.google_refresh_token) {
    throw new Error("Google Calendar no autorizado para esta clínica.");
  }

  const client = getOAuthClient();

  // Cuando google-auth-library refresca el token automáticamente, emite "tokens".
  // Persistimos el nuevo access_token / expiry para evitar refrescos innecesarios.
  client.on("tokens", async (tokens) => {
    if (!clinic.slug) return;

    try {
      await updateClinicBySlug(clinic.slug, {
        google_connected: true,
        google_refresh_token: tokens.refresh_token ?? clinic.google_refresh_token,
        google_calendar_id: clinic.google_calendar_id ?? "primary",
        google_email: clinic.google_email,
        google_token_scope: tokens.scope?.trim() || clinic.google_token_scope,
        google_token_type: tokens.token_type?.trim() || clinic.google_token_type,
        google_token_expires_at:
          typeof tokens.expiry_date === "number"
            ? new Date(tokens.expiry_date).toISOString()
            : clinic.google_token_expires_at,
      });
    } catch (persistError) {
      console.warn("[google.calendar] Failed to persist refreshed token", {
        clinicSlug: clinic.slug,
        error: persistError instanceof Error ? persistError.message : String(persistError),
      });
    }
  });

  client.setCredentials({
    refresh_token: clinic.google_refresh_token,
  });

  // Forzar refresh anticipado si el access_token está vencido — evita 401 silenciosos.
  try {
    await client.getAccessToken();
  } catch (refreshError) {
    const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
    // invalid_grant = refresh token revocado por el usuario en su cuenta de Google.
    if (message.includes("invalid_grant") && clinic.slug) {
      await updateClinicBySlug(clinic.slug, {
        google_connected: false,
        google_refresh_token: null,
        google_token_expires_at: null,
      });
      throw new Error("Google Calendar: el acceso fue revocado. Reconecta la cuenta.");
    }
    throw refreshError;
  }

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
  const clinic = await getClinicGoogleConfig(resolvedSlug);
  return buildGoogleCalendarAuthUrl(clinic);
}

export async function getGoogleCalendarAuthUrlByClinicId(clinicId: string): Promise<string> {
  const clinic = await getClinicGoogleConfigById(clinicId);
  return buildGoogleCalendarAuthUrl(clinic);
}

export async function completeGoogleCalendarOAuth(code: string, clinicId: string): Promise<void> {
  const clinic = await getClinicGoogleConfigById(clinicId);
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  const refreshToken = tokens.refresh_token?.trim() || clinic.google_refresh_token;

  if (!refreshToken) {
    throw new Error("Google no devolvió refresh_token para esta clínica.");
  }

  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  await updateClinicBySlug(clinic.slug, {
    google_connected: true,
    google_email: profile.email?.trim() || clinic.google_email,
    google_refresh_token: refreshToken,
    google_calendar_id: clinic.google_calendar_id || "primary",
    google_token_scope: tokens.scope?.trim() || clinic.google_token_scope,
    google_token_type: tokens.token_type?.trim() || clinic.google_token_type,
    google_token_expires_at:
      typeof tokens.expiry_date === "number"
        ? new Date(tokens.expiry_date).toISOString()
        : clinic.google_token_expires_at,
  });
}

export async function disconnectGoogleCalendar(clinicSlug?: string | null): Promise<void> {
  const clinic = await getClinicGoogleConfig(clinicSlug);

  await updateClinicBySlug(clinic.slug, {
    google_connected: false,
    google_email: null,
    google_refresh_token: null,
    google_calendar_id: null,
    google_token_scope: null,
    google_token_type: null,
    google_token_expires_at: null,
  });
}

export async function getGoogleCalendarBusyRangesForDate(
  date: Date,
  clinicSlug?: string | null,
  calendarId?: string | null,
): Promise<BusyRange[]> {
  try {
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
  } catch (error) {
    console.warn("[google.calendar] Falling back to internal availability only", {
      clinicSlug: clinicSlug?.trim() || null,
      date: date.toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
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
        timeZone: clinic.timezone || DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: clinic.timezone || DEFAULT_TIMEZONE,
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
  if (!clinic || !clinic.google_connected || !clinic.google_refresh_token) {
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

  const statusMeta =
    appointment.status === "completed"
      ? {
          summaryPrefix: "Asistio",
          lines: [
            "Estado: COMPLETADA",
            "La clinica marco la cita como asistida",
          ],
        }
      : {
          summaryPrefix: "Confirmada",
          lines: [
            "Estado: CONFIRMADA",
            "La cita fue confirmada o actualizada",
          ],
        };

  const summary = `${statusMeta.summaryPrefix} - ${appointment.service} - ${appointment.patient_name}`;
  const description = [
    ...statusMeta.lines,
    "",
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
        timeZone: clinic.timezone || DEFAULT_TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: clinic.timezone || DEFAULT_TIMEZONE,
      },
    },
  });
}

