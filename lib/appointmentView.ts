import type { Appointment, AppointmentStatus } from "@/lib/types";

/**
 * Campos mínimos que necesita toViewAppointment.
 * Compatible con AppointmentRow y PatientAppointmentRow.
 */
export type AppointmentRowLike = {
  id: number;
  token: string;
  clinic_name: string;
  service: string;
  scheduled_at?: string | null;
  datetime_label: string;
  patient_name: string;
  address: string;
  duration_label: string;
  status: AppointmentStatus;
  updated_at: string;
};

export function toViewAppointment(row: AppointmentRowLike): Appointment {
  return {
    token: row.token,
    clinicName: row.clinic_name,
    service: row.service,
    datetimeLabel: row.datetime_label,
    scheduledAt: row.scheduled_at,
    patientName: row.patient_name,
    address: row.address,
    durationLabel: row.duration_label,
    status: row.status,
    lastUpdateLabel: row.updated_at,
    idLabel: `${row.clinic_name.slice(0, 2).toUpperCase()}-${row.id}`,
  };
}

export function toViewAppointmentOrNull(
  row: AppointmentRowLike | null | undefined,
): Appointment | null {
  if (!row) return null;
  return toViewAppointment(row);
}
