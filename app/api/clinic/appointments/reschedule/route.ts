import { getAppointmentByToken } from "@/lib/appointments";
import { sendAppointmentRescheduledEmail } from "@/lib/appointmentEmails";
import {
  applyRescheduleUpdate,
  regenerateDatetimeLabel,
  validateSlotAvailable,
} from "@/lib/appointmentReschedule";
import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { getClinicById, resolveClinicCopyEmail } from "@/lib/clinics";
import { updateCalendarEvent } from "@/lib/googleCalendar";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type RescheduleBody = {
  token?: string;
  new_scheduled_at?: string;
  notify_patient?: boolean;
};

const EDITABLE_STATUSES = new Set(["confirmed", "pending"]);

export async function POST(request: Request) {
  try {
    const access = await requireCurrentClinicForApi();
    const body = (await request.json()) as RescheduleBody;

    const token = body.token?.trim().toLowerCase();
    const newScheduledAtRaw = body.new_scheduled_at?.trim();
    const notifyPatient = body.notify_patient !== false; // default true

    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 });
    }
    if (!newScheduledAtRaw) {
      return NextResponse.json({ error: "new_scheduled_at es requerido" }, { status: 400 });
    }

    const scheduledDate = new Date(newScheduledAtRaw);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "new_scheduled_at no es una fecha válida" }, { status: 400 });
    }

    // 1. Cita existe y pertenece a la clínica autenticada
    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }
    if (current.clinic_id !== access.clinicId) {
      return NextResponse.json(
        { error: "No puedes operar sobre esa cita" },
        { status: 403 },
      );
    }

    // 2. Estado editable
    if (!EDITABLE_STATUSES.has(current.status)) {
      return NextResponse.json(
        { error: "No se puede mover una cita ya completada o cancelada" },
        { status: 400 },
      );
    }

    // 3. Bloquear citas ya pasadas (la cita actual debe ser futura)
    if (current.scheduled_at) {
      const currentScheduled = new Date(current.scheduled_at);
      if (!Number.isNaN(currentScheduled.getTime()) && currentScheduled.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: "No se puede mover una cita ya pasada" },
          { status: 400 },
        );
      }
    }

    // 4. Nueva fecha no es pasada
    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "La nueva fecha no puede ser anterior a hoy" },
        { status: 400 },
      );
    }

    // 5. Slot disponible (incluye horario clínica + bloques + colisiones con otras citas)
    const validation = await validateSlotAvailable({
      clinicSlug: access.clinicSlug,
      scheduledAt: scheduledDate,
      service: current.service,
      excludeToken: current.token,
    });
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 409 });
    }

    // Resolver clinic_users.id para auditoría (FK del nuevo updated_by_clinic_user_id)
    let updatedByClinicUserId: string | null = null;
    if (access.userId !== "admin-impersonation") {
      const { data: clinicUserRow } = await supabaseAdmin
        .from("clinic_users")
        .select("id")
        .eq("user_id", access.userId)
        .eq("clinic_id", access.clinicId)
        .maybeSingle<{ id: string }>();
      updatedByClinicUserId = clinicUserRow?.id ?? null;
    }

    const clinic = current.clinic_id ? await getClinicById(current.clinic_id) : null;
    const datetimeLabel = regenerateDatetimeLabel(scheduledDate, clinic?.timezone);

    // 6. UPDATE atómico (incluye reset reminder_sent_at + auditoría)
    const updated = await applyRescheduleUpdate({
      token: current.token,
      newScheduledAt: scheduledDate,
      datetimeLabel,
      updatedByClinicUserId,
      resetReminder: true,
    });

    // 7. Sincronizar Google Calendar (no bloqueante)
    let calendarWarning: string | null = null;
    if (updated.google_event_id && clinic?.slug) {
      try {
        await updateCalendarEvent(
          updated,
          updated.google_event_id,
          updated.calendar_id,
          clinic.slug,
        );
      } catch (error) {
        calendarWarning =
          error instanceof Error ? error.message : "No se pudo sincronizar Google Calendar";
      }
    }

    // 8. Notificación al paciente (no bloqueante — error en email no rompe la operación)
    if (notifyPatient) {
      try {
        await sendAppointmentRescheduledEmail(updated, {
          notificationEmail: resolveClinicCopyEmail(clinic),
          timezone: clinic?.timezone,
        });
      } catch (emailError) {
        console.error("[clinic.reschedule] Failed to send rescheduled email", {
          token: updated.token,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    return NextResponse.json({ ok: true, appointment: updated, calendarWarning });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo reprogramar la cita" },
      { status: 500 },
    );
  }
}
