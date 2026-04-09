import "server-only";

import type { AppointmentRow } from "@/lib/appointments";
import { darkenHex } from "@/lib/color";
import { getClinicById } from "@/lib/clinics";

const DEFAULT_PRIMARY_COLOR = "#2563eb";
const DEFAULT_ACCENT_COLOR = "#1d4ed8";

export type PatientClinicContext = {
  id: string | null;
  slug: string | null;
  name: string;
  supportPhone: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  logoText: string;
  cancelHoursLimit: number;
  timezone: string;
};

export type PatientAppointmentDetails = {
  appointment: AppointmentRow;
  clinic: PatientClinicContext;
};

function buildLogoText(name: string): string {
  const words = name
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (words.length === 0) return "RC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export async function getPatientClinicContext(
  appointment: AppointmentRow,
): Promise<PatientClinicContext> {
  const clinic = appointment.clinic_id ? await getClinicById(appointment.clinic_id) : null;
  const name = clinic?.name?.trim() || appointment.clinic_name.trim() || "Clínica";
  const primaryColor = clinic?.theme_color?.trim() || DEFAULT_PRIMARY_COLOR;

  return {
    id: clinic?.id ?? appointment.clinic_id ?? null,
    slug: clinic?.slug ?? null,
    name,
    supportPhone: clinic?.phone?.trim() || null,
    logoUrl: clinic?.logo_url?.trim() || null,
    primaryColor,
    accentColor: darkenHex(primaryColor, 12) || DEFAULT_ACCENT_COLOR,
    logoText: buildLogoText(name),
    cancelHoursLimit: clinic?.cancel_hours_limit ?? 24,
    timezone: clinic?.timezone?.trim() || "Atlantic/Canary",
  };
}

export async function getPatientAppointmentDetails(
  appointment: AppointmentRow,
): Promise<PatientAppointmentDetails> {
  return {
    appointment,
    clinic: await getPatientClinicContext(appointment),
  };
}
