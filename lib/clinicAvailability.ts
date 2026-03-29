import "server-only";

import {
  buildDaySlotsFromTimeRange,
  formatTimeLabel,
  getBusyRangesFromAppointments,
  rangesOverlap,
  type AvailableSlot,
} from "@/lib/availability";
import { getAppointmentByToken } from "@/lib/appointments";
import { getClinicById, getClinicBySlug } from "@/lib/clinics";
import { getClinicHoursByClinicSlug } from "@/lib/clinicHours";
import { getGoogleCalendarBusyRangesForDate } from "@/lib/googleCalendar";
import { getServiceByClinicSlugAndName } from "@/lib/services";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AvailabilityAppointmentRow = {
  scheduled_at: string | null;
  duration_label: string | null;
  token: string | null;
  status: string | null;
};

type ClinicAvailabilityParams = {
  clinicSlug: string;
  date: Date;
  service?: string | null;
  excludeToken?: string;
};

type ClinicAvailableDatesParams = {
  clinicSlug: string;
  startDate: Date;
  service?: string | null;
  excludeToken?: string;
  limit?: number;
  searchDays?: number;
};

export type AvailableDateOption = {
  value: string;
  label: string;
};

function startOfLocalDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfNextLocalDay(date: Date): Date {
  const result = startOfLocalDay(date);
  result.setDate(result.getDate() + 1);
  return result;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAvailableDateLabel(date: Date): string {
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
  const monthDay = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
  }).format(date);

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} · ${monthDay}`;
}

export async function getClinicSlugForAppointmentToken(token: string): Promise<string | null> {
  const appointment = await getAppointmentByToken(token);
  if (!appointment) return null;

  if (appointment.clinic_id) {
    const clinic = await getClinicById(appointment.clinic_id);
    if (clinic?.slug) return clinic.slug;
  }

  const clinicBySlug = await getClinicBySlug(appointment.clinic_name);
  return clinicBySlug?.slug ?? null;
}

export async function getAvailableSlotsForClinicDate({
  clinicSlug,
  date,
  service,
  excludeToken,
}: ClinicAvailabilityParams): Promise<AvailableSlot[]> {
  const safeClinicSlug = clinicSlug.trim();
  const clinic = await getClinicBySlug(safeClinicSlug);

  if (!clinic?.id) {
    throw new Error("Clinica no encontrada");
  }

  const startOfDay = startOfLocalDay(date);
  const endOfNextDay = endOfNextLocalDay(date);

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("scheduled_at, duration_label, token, status")
    .eq("clinic_id", clinic.id)
    .gte("scheduled_at", startOfDay.toISOString())
    .lt("scheduled_at", endOfNextDay.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const appointmentBusyRanges = getBusyRangesFromAppointments({
    date,
    appointments: (data ?? []) as AvailabilityAppointmentRow[],
    excludeToken,
  });
  const googleBusyRanges = await getGoogleCalendarBusyRangesForDate(date, safeClinicSlug);
  const busyRanges = [...appointmentBusyRanges, ...googleBusyRanges];

  const serviceRow =
    service?.trim() ? await getServiceByClinicSlugAndName(safeClinicSlug, service.trim()) : null;
  const slotMinutes =
    serviceRow?.duration_minutes && serviceRow.duration_minutes > 0
      ? serviceRow.duration_minutes
      : 30;
  const slotDurationMs = slotMinutes * 60_000;

  const clinicHours = await getClinicHoursByClinicSlug(safeClinicSlug);
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
  const clinicHour = clinicHours.find((item) => item.day_of_week === dayOfWeek);

  if (!clinicHour) {
    return [];
  }

  const daySlots = buildDaySlotsFromTimeRange(
    date,
    clinicHour.start_time,
    clinicHour.end_time,
    slotMinutes,
  );

  return daySlots
    .filter((slotStart) => {
      const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
      return !busyRanges.some((occupied) =>
        rangesOverlap(slotStart, slotEnd, occupied.start, occupied.end),
      );
    })
    .map((slot) => ({
      value: slot.toISOString(),
      label: formatTimeLabel(slot),
    }));
}

export async function getAvailableDatesForClinic({
  clinicSlug,
  startDate,
  service,
  excludeToken,
  limit = 14,
  searchDays = 45,
}: ClinicAvailableDatesParams): Promise<AvailableDateOption[]> {
  const results: AvailableDateOption[] = [];
  const safeStartDate = startOfLocalDay(startDate);

  for (let offset = 0; offset < searchDays && results.length < limit; offset += 1) {
    const currentDate = new Date(safeStartDate);
    currentDate.setDate(safeStartDate.getDate() + offset);

    const slots = await getAvailableSlotsForClinicDate({
      clinicSlug,
      date: currentDate,
      service,
      excludeToken,
    });

    if (slots.length === 0) {
      continue;
    }

    results.push({
      value: toDateInputValue(currentDate),
      label: formatAvailableDateLabel(currentDate),
    });
  }

  return results;
}
