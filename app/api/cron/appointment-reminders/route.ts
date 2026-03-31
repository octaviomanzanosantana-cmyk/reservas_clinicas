import { sendAppointmentReminderEmail } from "@/lib/appointmentEmails";
import type { AppointmentRow } from "@/lib/appointments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

// Buscar citas entre 47h30m y 48h30m en el futuro.
// Con ejecución cada hora, cada cita cae en exactamente una ventana.
const REMINDER_HOURS = 48;
const MARGIN_MINUTES = 30;

export async function GET(request: NextRequest) {
  // Proteger con CRON_SECRET (Vercel envía este header automáticamente)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const windowStart = new Date(
      now.getTime() + (REMINDER_HOURS * 60 - MARGIN_MINUTES) * 60_000,
    );
    const windowEnd = new Date(
      now.getTime() + (REMINDER_HOURS * 60 + MARGIN_MINUTES) * 60_000,
    );

    // Buscar citas en la ventana de 48h que:
    // - No estén canceladas
    // - Tengan email del paciente
    // - No se les haya enviado ya un recordatorio
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

    const results: { token: string; email: string; sent: boolean; error?: string }[] = [];

    for (const appointment of (appointments ?? []) as AppointmentRow[]) {
      try {
        await sendAppointmentReminderEmail(appointment);

        // Marcar como enviado para evitar duplicados
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
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
      },
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
