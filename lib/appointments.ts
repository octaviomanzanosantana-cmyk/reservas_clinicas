import { supabase } from "@/lib/supabase";
import type { AppointmentStatus } from "@/lib/types";

export type AppointmentRow = {
  id: number;
  token: string;
  clinic_id: string | null;
  clinic_name: string;
  patient_name: string;
  patient_phone: string | null;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  address: string;
  duration_label: string;
  status: AppointmentStatus;
  google_event_id: string | null;
  calendar_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAppointmentInput = Omit<
  AppointmentRow,
  "id" | "created_at" | "updated_at" | "google_event_id" | "calendar_id" | "patient_phone"
> & {
  patient_phone?: string | null;
  google_event_id?: string | null;
  calendar_id?: string | null;
};
export type UpdateAppointmentInput = Partial<
  Pick<
    AppointmentRow,
    | "status"
    | "scheduled_at"
    | "datetime_label"
    | "service"
    | "address"
    | "duration_label"
    | "google_event_id"
    | "calendar_id"
  >
>;

function normalizeToken(token: string): string {
  return token.trim().toLowerCase();
}

export async function getAppointmentByToken(token: string): Promise<AppointmentRow | null> {
  const safeToken = normalizeToken(token);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("token", safeToken)
    .maybeSingle<AppointmentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function listAppointmentsByClinic(
  clinicName: string,
  limit = 100,
): Promise<AppointmentRow[]> {
  const safeClinicName = clinicName.trim();
  if (!safeClinicName) return [];

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("clinic_name", safeClinicName)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data as AppointmentRow[]) ?? [];
}

export async function createAppointment(data: CreateAppointmentInput): Promise<AppointmentRow> {
  const payload: CreateAppointmentInput = {
    clinic_id: data.clinic_id,
    clinic_name: data.clinic_name,
    patient_name: data.patient_name,
    service: data.service,
    scheduled_at: data.scheduled_at,
    datetime_label: data.datetime_label,
    address: data.address,
    duration_label: data.duration_label,
    status: data.status,
    token: normalizeToken(data.token),
    patient_phone:
      typeof data.patient_phone === "string" ? data.patient_phone.trim() || null : null,
    google_event_id:
      typeof data.google_event_id === "string" ? data.google_event_id.trim() || null : null,
    calendar_id: typeof data.calendar_id === "string" ? data.calendar_id.trim() || null : null,
  };

  const { data: created, error } = await supabase
    .from("appointments")
    .insert(payload)
    .select("*")
    .single<AppointmentRow>();

  if (error || !created) {
    throw new Error(error?.message ?? "No se pudo crear la cita");
  }

  return created;
}

export async function updateAppointmentStatus(
  token: string,
  status: AppointmentStatus,
): Promise<AppointmentRow | null> {
  return updateAppointment(token, { status });
}

export async function updateAppointment(
  token: string,
  data: UpdateAppointmentInput,
): Promise<AppointmentRow | null> {
  const safeToken = normalizeToken(token);

  const { data: updated, error } = await supabase
    .from("appointments")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("token", safeToken)
    .select("*")
    .maybeSingle<AppointmentRow>();

  if (error) {
    throw new Error(error.message);
  }

  return updated ?? null;
}
