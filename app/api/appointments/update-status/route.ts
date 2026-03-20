import { getAppointmentByToken, updateAppointmentStatus, type AppointmentRow } from "@/lib/appointments";
import { assertCurrentClinicAccessForApi, ClinicAccessError } from "@/lib/clinicAuth";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

type UpdateAppointmentStatusRequest = {
  token?: string;
  status?: "confirmed" | "cancelled" | "completed";
};

const VALID_STATUSES = new Set(["confirmed", "cancelled", "completed"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateAppointmentStatusRequest;
    const token = body.token?.trim().toLowerCase();

    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 });
    }

    if (!body.status || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "status invalido" }, { status: 400 });
    }

    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    await assertCurrentClinicAccessForApi({ clinicId: current.clinic_id });

    const appointment = (await updateAppointmentStatus(token, body.status)) ?? current;
    let calendarWarning: string | null = null;

    try {
      if (body.status === "cancelled" && current.google_event_id) {
        await deleteCalendarEvent(
          current.google_event_id,
          current.calendar_id,
          undefined,
          current.clinic_id,
        );
      } else if (
        (body.status === "confirmed" || body.status === "completed") &&
        appointment.google_event_id
      ) {
        await updateCalendarEvent(
          appointment as AppointmentRow,
          appointment.google_event_id,
          appointment.calendar_id,
          undefined,
        );
      }
    } catch (error) {
      calendarWarning =
        error instanceof Error
          ? error.message
          : "No se pudo sincronizar Google Calendar";
    }

    return NextResponse.json({ appointment, calendarWarning });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la cita" },
      { status: 500 },
    );
  }
}
