import {
  buildDaySlotsFromTimeRange,
  formatTimeLabel,
  getAvailableSlotsForDate,
  getBusyRangesFromAppointments,
  rangesOverlap,
} from "@/lib/availability";
import { getClinicBySlug } from "@/lib/clinics";
import { getClinicHoursByClinicSlug } from "@/lib/clinicHours";
import { getGoogleCalendarBusyRangesForDate } from "@/lib/googleCalendar";
import { getServiceByClinicSlugAndName } from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

type AvailabilityAppointmentRow = {
  scheduled_at: string | null;
  duration_label: string | null;
  token: string | null;
  status: string | null;
};

function parseDateParam(dateParam: string): Date | null {
  const match = dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const excludeToken = searchParams.get("excludeToken") ?? undefined;
    const clinicSlug = searchParams.get("clinicSlug")?.trim();
    const service = searchParams.get("service")?.trim();

    if (!dateParam) {
      return NextResponse.json({ error: "date es requerido" }, { status: 400 });
    }

    const date = parseDateParam(dateParam);
    if (!date) {
      return NextResponse.json({ error: "date inválido, usa YYYY-MM-DD" }, { status: 400 });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfNextDay = new Date(date);
    endOfNextDay.setDate(endOfNextDay.getDate() + 1);
    endOfNextDay.setHours(0, 0, 0, 0);

    const clinicRow = clinicSlug ? await getClinicBySlug(clinicSlug) : null;
    if (clinicSlug && !clinicRow?.id) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }
    let appointmentsQuery = supabase
      .from("appointments")
      .select("scheduled_at, duration_label, token, status")
      .gte("scheduled_at", startOfDay.toISOString())
      .lt("scheduled_at", endOfNextDay.toISOString());
    if (clinicRow?.id) {
      appointmentsQuery = appointmentsQuery.eq("clinic_id", clinicRow.id);
    }

    const { data, error } = await appointmentsQuery;

    if (error) {
      throw new Error(error.message);
    }

    const appointmentBusyRanges = getBusyRangesFromAppointments({
      date,
      appointments: (data ?? []) as AvailabilityAppointmentRow[],
      excludeToken,
    });
    const googleBusyRanges = clinicSlug
      ? await getGoogleCalendarBusyRangesForDate(date, clinicSlug)
      : [];
    const busyRanges = [...appointmentBusyRanges, ...googleBusyRanges];
    const serviceRow =
      clinicSlug && service
        ? await getServiceByClinicSlugAndName(clinicSlug, service)
        : null;
    const slotMinutes = serviceRow?.duration_minutes;

    const slots = clinicSlug
      ? await (async () => {
          const clinicHours = await getClinicHoursByClinicSlug(clinicSlug);
          const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
          const clinicHour = clinicHours.find((item) => item.day_of_week === dayOfWeek);

          if (!clinicHour) {
            return [];
          }

          const safeSlotMinutes = slotMinutes && slotMinutes > 0 ? slotMinutes : 30;
          const slotDurationMs = safeSlotMinutes * 60_000;
          const daySlots = buildDaySlotsFromTimeRange(
            date,
            clinicHour.start_time,
            clinicHour.end_time,
            safeSlotMinutes,
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
        })()
      : getAvailableSlotsForDate({
          date,
          busyRanges,
          ...(slotMinutes ? { slotMinutes } : {}),
        });

    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo calcular disponibilidad" },
      { status: 500 },
    );
  }
}
