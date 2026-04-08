import { getAppointmentByToken, updateAppointmentStatus, type AppointmentRow } from "@/lib/appointments";
import { sendAppointmentCreatedEmail } from "@/lib/appointmentEmails";
import { getClinicById } from "@/lib/clinics";
import { getPatientClinicContext } from "@/lib/patientContext";
import { updateCalendarEvent } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

type ConfirmRequestBody = {
  token: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmRequestBody;
    const token = body?.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    // No tocar por ahora el flujo de cambio solicitado.
    if (current.status === "change_requested") {
      return NextResponse.json({
        appointment: current,
        clinic: await getPatientClinicContext(current),
        calendarWarning: null,
      });
    }

    const confirmed = (await updateAppointmentStatus(token, "confirmed")) ?? current;
    let calendarWarning: string | null = null;

    if (confirmed.google_event_id) {
      try {
        await updateCalendarEvent(
          confirmed,
          confirmed.google_event_id,
          confirmed.calendar_id,
          undefined,
        );
      } catch (error) {
        calendarWarning =
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el evento en Google Calendar";
      }
    }

    if (confirmed.patient_email) {
      try {
        const clinic = confirmed.clinic_id ? await getClinicById(confirmed.clinic_id) : null;
        await sendAppointmentCreatedEmail(confirmed as AppointmentRow, {
          notificationEmail: clinic?.notification_email,
          reviewUrl: clinic?.review_url,
        });
      } catch (emailError) {
        console.error("[confirm] Failed to send confirmation email", {
          token: confirmed.token,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    return NextResponse.json({
      appointment: confirmed as AppointmentRow,
      clinic: await getPatientClinicContext(confirmed as AppointmentRow),
      calendarWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo confirmar la cita" },
      { status: 500 },
    );
  }
}
