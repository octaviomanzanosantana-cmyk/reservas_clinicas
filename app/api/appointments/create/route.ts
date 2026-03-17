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
import { getClinicBySlug } from "@/lib/clinics";
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
    const normalizedPayload: CreateAppointmentRequest = {
      ...payload,
      patient_phone:
        typeof payload.patient_phone === "string" ? payload.patient_phone.trim() || null : null,
    };
    const scheduledAtValue =
      typeof normalizedPayload.scheduled_at === "string" ? normalizedPayload.scheduled_at.trim() : "";

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

    const clinicSlug =
      typeof payload.clinicSlug === "string" && payload.clinicSlug.trim()
        ? payload.clinicSlug.trim()
        : "";
    const clinicRow = clinicSlug ? await getClinicBySlug(clinicSlug) : null;
    if (clinicSlug && !clinicRow?.id) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }
    let appointmentsQuery = supabaseAdmin
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
    });
    const googleBusyRanges = clinicSlug
      ? await getGoogleCalendarBusyRangesForDate(date, clinicSlug)
      : [];
    const busyRanges = [...appointmentBusyRanges, ...googleBusyRanges];
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

    let existingAppointmentQuery = supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("scheduled_at", scheduledAtValue)
      .neq("status", "cancelled");
    if (clinicRow?.id) {
      existingAppointmentQuery = existingAppointmentQuery.eq("clinic_id", clinicRow.id);
    } else {
      existingAppointmentQuery = existingAppointmentQuery.eq(
        "clinic_name",
        normalizedPayload.clinic_name,
      );
    }

    const { data: existingAppointment, error: existingAppointmentError } =
      await existingAppointmentQuery.maybeSingle();

    if (existingAppointmentError) {
      throw new Error(existingAppointmentError.message);
    }

    if (existingAppointment) {
      return NextResponse.json(
        { error: "Este horario ya no está disponible" },
        { status: 409 },
      );
    }

    const appointment = await createAppointment({
      ...normalizedPayload,
      clinic_id: clinicRow?.id ?? normalizedPayload.clinic_id,
      clinic_name: clinicRow?.name ?? normalizedPayload.clinic_name,
    });

    let nextAppointment: AppointmentRow = appointment;
    let calendarWarning: string | null = null;

    try {
      if (clinicRow?.google_connected) {
        const { eventId, calendarId } = await createCalendarEvent(appointment, clinicSlug);
        const updated = await updateAppointment(appointment.token, {
          google_event_id: eventId,
          calendar_id: calendarId,
        });

        if (updated) {
          nextAppointment = updated;
        }
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
