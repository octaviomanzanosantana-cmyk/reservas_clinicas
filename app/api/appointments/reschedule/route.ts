import { getAppointmentByToken, updateAppointment } from "@/lib/appointments";
import { sendAppointmentRescheduledEmail } from "@/lib/appointmentEmails";
import { getAvailableSlotsForClinicDate } from "@/lib/clinicAvailability";
import { getClinicById } from "@/lib/clinics";
import { buildDateTimeLabel } from "@/lib/dateFormat";
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
      datetime_label: buildDateTimeLabel(scheduledDate, clinic?.timezone),
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

    try {
      await sendAppointmentRescheduledEmail(updated, {
        notificationEmail: clinic?.notification_email,
        timezone: clinic?.timezone,
      });
    } catch (error) {
      console.error("[appointments.reschedule] Failed to send appointment rescheduled email", {
        appointmentToken: updated.token,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return NextResponse.json({ ok: true, appointment: updated, calendarWarning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reprogramar la cita" },
      { status: 500 },
    );
  }
}
