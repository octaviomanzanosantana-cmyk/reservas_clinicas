import { getAppointmentByToken, updateAppointmentStatus, type AppointmentRow } from "@/lib/appointments";
import { deleteCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

type CancelRequestBody = {
  token: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CancelRequestBody;
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (current.scheduled_at) {
      const scheduledAt = new Date(current.scheduled_at);

      if (!Number.isNaN(scheduledAt.getTime())) {
        const diffMs = scheduledAt.getTime() - Date.now();
        const twoHoursMs = 2 * 60 * 60 * 1000;

        if (diffMs < twoHoursMs) {
          return NextResponse.json(
            { error: "No se puede cancelar con menos de 2 horas de antelación" },
            { status: 400 },
          );
        }
      }
    }

    const cancelled = (await updateAppointmentStatus(token, "cancelled")) ?? current;
    let calendarWarning: string | null = null;

    if (current.google_event_id) {
      try {
        await deleteCalendarEvent(current.google_event_id, current.calendar_id);
      } catch (error) {
        calendarWarning =
          error instanceof Error
            ? error.message
            : "No se pudo cancelar el evento en Google Calendar";
      }
    }

    return NextResponse.json({
      appointment: cancelled as AppointmentRow,
      calendarWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cancelar la cita" },
      { status: 500 },
    );
  }
}
