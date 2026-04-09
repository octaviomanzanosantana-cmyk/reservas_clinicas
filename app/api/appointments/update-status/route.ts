import { getAppointmentByToken, updateAppointmentStatus, type AppointmentRow } from "@/lib/appointments";
import { sendAppointmentCancelledEmail, sendAppointmentReviewEmail } from "@/lib/appointmentEmails";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertCurrentClinicAccessForApi, ClinicAccessError } from "@/lib/clinicAuth";
import { getClinicById } from "@/lib/clinics";
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

    // Email de cancelación al paciente cuando la clínica cancela
    if (body.status === "cancelled" && appointment.patient_email) {
      try {
        const clinic = appointment.clinic_id ? await getClinicById(appointment.clinic_id) : null;
        const bookingUrl = clinic?.slug ? `https://app.appoclick.com/b/${clinic.slug}` : undefined;
        await sendAppointmentCancelledEmail(appointment as AppointmentRow, {
          notificationEmail: clinic?.notification_email,
          bookingUrl,
          timezone: clinic?.timezone,
        });
      } catch (emailError) {
        console.error("[update-status] Failed to send cancellation email", {
          token: appointment.token,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    // Enviar email de reseña al marcar como "Asistió" (solo primera visita, no revisiones)
    const isPrimeraVisita = !current.appointment_type || current.appointment_type === "primera_visita";
    if (body.status === "completed" && !current.review_sent_at && isPrimeraVisita) {
      const clinic = appointment.clinic_id ? await getClinicById(appointment.clinic_id) : null;
      console.log("[review email] status:", body.status);
      console.log("[review email] review_url:", clinic?.review_url ?? null);
      console.log("[review email] patient_email:", appointment.patient_email ?? null);

      if (appointment.patient_email) {
        try {
          await sendAppointmentReviewEmail(
            appointment as AppointmentRow,
            clinic?.review_url ?? null,
            { timezone: clinic?.timezone },
          );

          const reviewTimestamp = new Date().toISOString();
          await supabaseAdmin
            .from("appointments")
            .update({ review_sent_at: reviewTimestamp })
            .eq("token", appointment.token);
          (appointment as Record<string, unknown>).review_sent_at = reviewTimestamp;
        } catch (emailError) {
          console.error("[update-status] Failed to send review email", {
            token: appointment.token,
            error: emailError instanceof Error ? emailError.message : String(emailError),
          });
        }
      }
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
