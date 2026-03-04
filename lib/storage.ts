import { getClinicConfig } from "@/lib/demoClinics";
import type { Appointment, AppointmentStatus } from "@/lib/types";

function storageKey(token: string): string {
  return `reservas_clinicas:${token}`;
}

export function buildDefaultAppointment(token: string): Appointment {
  const clinic = getClinicConfig(token);

  return {
    token,
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
  if (typeof window === "undefined") {
    return buildDefaultAppointment(token);
  }

  try {
    const raw = window.localStorage.getItem(storageKey(token));
    if (!raw) {
      const initial = buildDefaultAppointment(token);
      saveAppointment(initial);
      return initial;
    }

    const parsed = JSON.parse(raw) as Appointment;
    if (!parsed || typeof parsed !== "object") {
      const initial = buildDefaultAppointment(token);
      saveAppointment(initial);
      return initial;
    }

    return { ...buildDefaultAppointment(token), ...parsed, token };
  } catch {
    const initial = buildDefaultAppointment(token);
    saveAppointment(initial);
    return initial;
  }
}

export function saveAppointment(appointment: Appointment): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(appointment.token), JSON.stringify(appointment));
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
