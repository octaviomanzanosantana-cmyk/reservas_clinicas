import { getClinicConfig } from "@/lib/demoClinics";
import type { ActivityAction, ActivityEvent, Appointment, AppointmentStatus } from "@/lib/types";

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

function storageKey(token: string): string {
  return `reservas_clinicas:${normalizeToken(token)}`;
}

function activityStorageKey(): string {
  return "reservas_clinicas:activity";
}

function notifyStorageUpdated(token: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("reservas_clinicas:updated", {
      detail: { token: normalizeToken(token) },
    }),
  );
}

export function buildDefaultAppointment(token: string): Appointment {
  const safeToken = normalizeToken(token);
  const clinic = getClinicConfig(safeToken);

  return {
    token: safeToken,
    clinicName: clinic.clinicName,
    service: clinic.defaultAppointment.service,
    datetimeLabel: clinic.defaultAppointment.datetimeLabel,
    patientName: clinic.defaultAppointment.patientName,
    address: clinic.address,
    durationLabel: clinic.defaultAppointment.durationLabel,
    status: "pending",
    lastUpdateLabel: "Hace unos segundos",
    idLabel: clinic.defaultAppointment.idLabel,
  };
}

export function loadAppointment(token: string): Appointment {
  const safeToken = normalizeToken(token);

  if (typeof window === "undefined") {
    return buildDefaultAppointment(safeToken);
  }

  try {
    const raw = window.localStorage.getItem(storageKey(safeToken));
    if (!raw) {
      const initial = buildDefaultAppointment(safeToken);
      saveAppointment(initial);
      return initial;
    }

    const parsed = JSON.parse(raw) as Appointment;
    if (!parsed || typeof parsed !== "object") {
      const initial = buildDefaultAppointment(safeToken);
      saveAppointment(initial);
      return initial;
    }

    return { ...buildDefaultAppointment(safeToken), ...parsed, token: safeToken };
  } catch {
    const initial = buildDefaultAppointment(safeToken);
    saveAppointment(initial);
    return initial;
  }
}

export function saveAppointment(appointment: Appointment): void {
  if (typeof window === "undefined") {
    return;
  }
  const safeToken = normalizeToken(appointment.token);
  const safeAppointment = { ...appointment, token: safeToken };
  window.localStorage.setItem(storageKey(safeToken), JSON.stringify(safeAppointment));
  notifyStorageUpdated(safeToken);
}

export function updateAppointmentStatus(
  token: string,
  status: AppointmentStatus,
  patch: Partial<Appointment> = {},
): Appointment {
  const current = loadAppointment(token);
  const next: Appointment = {
    ...current,
    ...patch,
    status,
    lastUpdateLabel: "Hace unos segundos",
  };
  saveAppointment(next);
  return next;
}

export function loadActivityEvents(): ActivityEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(activityStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ActivityEvent => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.token === "string" &&
        typeof item.patientName === "string" &&
        (typeof item.datetimeLabel === "string" || typeof item.datetimeLabel === "undefined") &&
        (item.action === "confirmed" || item.action === "change_requested" || item.action === "cancelled") &&
        typeof item.timestamp === "string"
      );
    }).map((item) => ({
      ...item,
      datetimeLabel: typeof item.datetimeLabel === "string" ? item.datetimeLabel : "",
    }));
  } catch {
    return [];
  }
}

function saveActivityEvents(events: ActivityEvent[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(activityStorageKey(), JSON.stringify(events));
}

export function registerActivityEvent(token: string, action: ActivityAction): ActivityEvent {
  const safeToken = normalizeToken(token);
  const appointment = loadAppointment(safeToken);
  const event: ActivityEvent = {
    token: safeToken,
    patientName: appointment.patientName,
    datetimeLabel: appointment.datetimeLabel,
    action,
    timestamp: new Date().toISOString(),
  };
  const events = loadActivityEvents();
  events.push(event);
  saveActivityEvents(events);
  notifyStorageUpdated(safeToken);
  return event;
}

export function getRecentActivityEvents(token: string, limit = 10): ActivityEvent[] {
  const safeToken = normalizeToken(token);
  return loadActivityEvents()
    .filter((item) => normalizeToken(item.token) === safeToken)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
