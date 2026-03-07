import {
  createAppointment,
  updateAppointment,
  type AppointmentRow,
  type CreateAppointmentInput,
} from "@/lib/appointments";
import { createCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateAppointmentInput;
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
