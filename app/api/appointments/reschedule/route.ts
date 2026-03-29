import { getAppointmentByToken, updateAppointment } from "@/lib/appointments";
import { getAvailableSlotsForClinicDate } from "@/lib/clinicAvailability";
import { getClinicById } from "@/lib/clinics";
import { updateCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

type RescheduleRequestBody = {
  token?: string;
  scheduled_at?: string;
  datetime_label?: string;
};

function buildDateTimeLabel(date: Date): string {
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
  const weekdayTitle = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  const timeLabel = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${weekdayTitle} · ${timeLabel}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RescheduleRequestBody;
    const token = body.token?.trim();
    const scheduledAt = body.scheduled_at?.trim();

    if (!token || !scheduledAt) {
      return NextResponse.json(
        { error: "token y scheduled_at son requeridos" },
        { status: 400 },
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "scheduled_at invalido" }, { status: 400 });
    }

    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const clinic = current.clinic_id ? await getClinicById(current.clinic_id) : null;
    const clinicSlug = clinic?.slug?.trim();

    if (!clinicSlug) {
      return NextResponse.json(
        { error: "No se pudo resolver la clinica de la cita" },
        { status: 400 },
      );
    }

    const requestedDay = new Date(scheduledDate);
    requestedDay.setHours(0, 0, 0, 0);

    const availableSlots = await getAvailableSlotsForClinicDate({
      clinicSlug,
      date: requestedDay,
      service: current.service,
      excludeToken: current.token,
    });

    const requestedSlot = scheduledDate.toISOString();
    const slotIsAvailable = availableSlots.some((slot) => slot.value === requestedSlot);

    if (!slotIsAvailable) {
      return NextResponse.json(
        { error: "Ese horario ya no esta disponible. Elige otro." },
        { status: 409 },
      );
    }

    const updated = await updateAppointment(token, {
      scheduled_at: requestedSlot,
      datetime_label: buildDateTimeLabel(scheduledDate),
      status: "confirmed",
    });

    if (!updated) {
      return NextResponse.json({ error: "No se pudo actualizar la cita" }, { status: 500 });
    }

    let calendarWarning: string | null = null;

    if (updated.google_event_id) {
      try {
        await updateCalendarEvent(updated, updated.google_event_id, updated.calendar_id, clinicSlug);
      } catch (error) {
        calendarWarning =
          error instanceof Error
            ? error.message
            : "No se pudo sincronizar Google Calendar";
      }
    }

    return NextResponse.json({ ok: true, appointment: updated, calendarWarning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reprogramar la cita" },
      { status: 500 },
    );
  }
}
