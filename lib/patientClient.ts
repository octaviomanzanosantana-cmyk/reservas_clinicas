import type { AppointmentRow } from "@/lib/appointments";

export type PatientClinicData = {
  id: string | null;
  slug: string | null;
  name: string;
  supportPhone: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  logoText: string;
  cancelHoursLimit: number;
};

export type PatientAppointmentResponse = {
  appointment?: AppointmentRow;
  clinic?: PatientClinicData;
  error?: string;
  calendarWarning?: string | null;
};

export async function fetchPatientAppointmentDetails(
  token: string,
): Promise<{
  appointment: AppointmentRow;
  clinic: PatientClinicData;
}> {
  const response = await fetch(`/api/appointments/details?token=${encodeURIComponent(token)}`);
  const data = (await response.json()) as PatientAppointmentResponse;

  if (!response.ok || !data.appointment || !data.clinic) {
    throw new Error(data.error ?? "No se pudo cargar la cita");
  }

  return {
    appointment: data.appointment,
    clinic: data.clinic,
  };
}
