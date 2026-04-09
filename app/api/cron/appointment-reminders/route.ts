import { sendAppointmentReminderEmail } from "@/lib/appointmentEmails";
import type { AppointmentRow } from "@/lib/appointments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

// Se ejecuta una vez al día a las 8:00 AM.
// Busca citas cuyo clinic.reminder_hours coincida con la ventana actual.
// Ventana por defecto: 24h–48h (para clínicas con reminder_hours=48).
// Cubre las 3 opciones: 24h, 48h, 72h.
const MAX_WINDOW_HOURS = 72;
const MIN_WINDOW_HOURS = 23; // 24h menos 1h de margen

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Ventana amplia: busca todas las citas entre 23h y 72h en el futuro.
    // Luego filtra por clinic.reminder_hours para cada cita.
    const windowStart = new Date(now.getTime() + MIN_WINDOW_HOURS * 3_600_000);
    const windowEnd = new Date(now.getTime() + MAX_WINDOW_HOURS * 3_600_000);

    const { data: appointments, error } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .gte("scheduled_at", windowStart.toISOString())
      .lt("scheduled_at", windowEnd.toISOString())
      .neq("status", "cancelled")
      .not("patient_email", "is", null)
      .is("reminder_sent_at", null);

    if (error) {
      throw new Error(error.message);
    }

    // Cargar configuración de recordatorio por clínica
    const clinicIds = [
      ...new Set(
        (appointments ?? [])
          .map((a: AppointmentRow) => a.clinic_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const clinicConfigMap = new Map<string, { reminder_hours: number; notification_email: string | null; review_url: string | null; timezone: string | null }>();

    if (clinicIds.length > 0) {
      const { data: clinics } = await supabaseAdmin
        .from("clinics")
        .select("id, reminder_hours, notification_email, review_url, timezone")
        .in("id", clinicIds);

      for (const c of clinics ?? []) {
        clinicConfigMap.set(c.id, {
          reminder_hours: c.reminder_hours ?? 48,
          notification_email: c.notification_email,
          review_url: c.review_url,
          timezone: c.timezone ?? null,
        });
      }
    }

    const results: { token: string; email: string; sent: boolean; error?: string }[] = [];

    for (const appointment of (appointments ?? []) as AppointmentRow[]) {
      const config = appointment.clinic_id
        ? clinicConfigMap.get(appointment.clinic_id)
        : null;
      const reminderHours = config?.reminder_hours ?? 48;

      // Verificar que la cita cae en la ventana correcta para esta clínica:
      // scheduled_at debe estar entre (now + reminderHours - 12h) y (now + reminderHours + 12h)
      // La ventana de 24h cubre la ejecución diaria del cron.
      if (appointment.scheduled_at) {
        const scheduledAt = new Date(appointment.scheduled_at).getTime();
        const targetTime = now.getTime() + reminderHours * 3_600_000;
        const diffHours = Math.abs(scheduledAt - targetTime) / 3_600_000;

        if (diffHours > 12) {
          continue; // No cae en la ventana de esta clínica
        }
      }

      try {
        await sendAppointmentReminderEmail(appointment, {
          notificationEmail: config?.notification_email,
          reviewUrl: config?.review_url,
          timezone: config?.timezone,
          reminderHours,
        });

        await supabaseAdmin
          .from("appointments")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("token", appointment.token);

        results.push({
          token: appointment.token,
          email: appointment.patient_email ?? "",
          sent: true,
        });
      } catch (emailError) {
        results.push({
          token: appointment.token,
          email: appointment.patient_email ?? "",
          sent: false,
          error: emailError instanceof Error ? emailError.message : "Error desconocido",
        });
      }
    }

    const sent = results.filter((r) => r.sent).length;
    const failed = results.filter((r) => !r.sent).length;

    return NextResponse.json({
      ok: true,
      window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
      found: results.length,
      sent,
      failed,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error en cron de recordatorios" },
      { status: 500 },
    );
  }
}
