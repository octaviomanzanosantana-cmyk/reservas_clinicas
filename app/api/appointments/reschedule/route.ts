import { getAppointmentByToken, updateAppointment } from "@/lib/appointments";
import { updateCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

type RescheduleRequestBody = {
  token?: string;
  scheduled_at?: string;
  datetime_label?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RescheduleRequestBody;
    const token = body.token?.trim();
    const scheduledAt = body.scheduled_at?.trim();
    const datetimeLabel = body.datetime_label?.trim();

    if (!token || !scheduledAt || !datetimeLabel) {
      return NextResponse.json(
        { error: "token, scheduled_at y datetime_label son requeridos" },
        { status: 400 },
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "scheduled_at inválido" }, { status: 400 });
    }

    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const updated = await updateAppointment(token, {
      scheduled_at: scheduledDate.toISOString(),
      datetime_label: datetimeLabel,
      status: "confirmed",
    });

    if (!updated) {
      return NextResponse.json({ error: "No se pudo actualizar la cita" }, { status: 500 });
    }

    if (updated.google_event_id) {
      await updateCalendarEvent(updated, updated.google_event_id, updated.calendar_id, undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reprogramar la cita" },
      { status: 500 },
    );
  }
}
