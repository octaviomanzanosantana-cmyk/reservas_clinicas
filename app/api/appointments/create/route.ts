import {
  createAppointment,
  updateAppointment,
  type AppointmentRow,
  type CreateAppointmentInput,
} from "@/lib/appointments";
import {
  getBusyRangesFromAppointments,
  parseDurationMinutes,
  rangesOverlap,
} from "@/lib/availability";
import {
  createCalendarEvent,
  getGoogleCalendarBusyRangesForDate,
} from "@/lib/googleCalendar";
import { getServiceByClinicSlugAndName } from "@/lib/services";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type AvailabilityAppointmentRow = {
  scheduled_at: string | null;
  duration_label: string | null;
  token: string | null;
  status: string | null;
};

type CreateAppointmentRequest = CreateAppointmentInput & {
  clinicSlug?: string | null;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateAppointmentRequest;
    const scheduledAtValue =
      typeof payload.scheduled_at === "string" ? payload.scheduled_at.trim() : "";

    if (!scheduledAtValue) {
      return NextResponse.json({ error: "scheduled_at es requerido" }, { status: 400 });
    }

    const scheduledAt = new Date(scheduledAtValue);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "scheduled_at inválido" }, { status: 400 });
    }

    const dateParam = `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, "0")}-${String(
      scheduledAt.getDate(),
    ).padStart(2, "0")}`;
    const [year, month, day] = dateParam.split("-").map((value) => Number.parseInt(value, 10));
    const date = new Date(year, month - 1, day);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfNextDay = new Date(date);
    endOfNextDay.setDate(endOfNextDay.getDate() + 1);
    endOfNextDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("scheduled_at, duration_label, token, status")
      .gte("scheduled_at", startOfDay.toISOString())
      .lt("scheduled_at", endOfNextDay.toISOString());

    if (error) {
      throw new Error(error.message);
    }

    const appointmentBusyRanges = getBusyRangesFromAppointments({
      date,
      appointments: (data ?? []) as AvailabilityAppointmentRow[],
    });
    const googleBusyRanges = await getGoogleCalendarBusyRangesForDate(date);
    const busyRanges = [...appointmentBusyRanges, ...googleBusyRanges];
    const clinicSlug =
      typeof payload.clinicSlug === "string" && payload.clinicSlug.trim()
        ? payload.clinicSlug.trim()
        : "";
    const serviceRow =
      clinicSlug && payload.service
        ? await getServiceByClinicSlugAndName(clinicSlug, payload.service)
        : null;
    const durationMinutes = serviceRow?.duration_minutes ?? parseDurationMinutes(payload.duration_label);
    const requestedStart = scheduledAt;
    const requestedEnd = new Date(requestedStart.getTime() + durationMinutes * 60_000);

    if (
      busyRanges.some((range) =>
        rangesOverlap(requestedStart, requestedEnd, range.start, range.end),
      )
    ) {
      return NextResponse.json(
        { error: "Ese horario ya no está disponible. Elige otro." },
        { status: 409 },
      );
    }

    const appointment = await createAppointment(payload);

    let nextAppointment: AppointmentRow = appointment;
    let calendarWarning: string | null = null;

    try {
      const { eventId, calendarId } = await createCalendarEvent(appointment);
      const updated = await updateAppointment(appointment.token, {
        google_event_id: eventId,
        calendar_id: calendarId,
      });

      if (updated) {
        nextAppointment = updated;
      }
    } catch (error) {
      calendarWarning =
        error instanceof Error
          ? error.message
          : "No se pudo crear el evento de Google Calendar";
    }

    return NextResponse.json({ appointment: nextAppointment, calendarWarning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la cita" },
      { status: 500 },
    );
  }
}
