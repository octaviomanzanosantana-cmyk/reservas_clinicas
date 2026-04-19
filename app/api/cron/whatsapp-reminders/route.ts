import { sendDailyWhatsAppReminders } from "@/lib/whatsappReminderEmail";
import { resetPastReminders } from "@/lib/whatsappReminders";
import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET?.trim();

/**
 * Endpoint cron unificado (Hobby = 2 crons máx).
 * Se invoca cada hora en punto (0 * * * *). En cada ejecución:
 *  1) Envía emails matinales a clínicas cuya hora local sea 9:00 AM
 *     (buildReminderEmail + filtro timezone por clínica).
 *  2) Si la hora UTC es 02:00, ejecuta también el reset nocturno de
 *     whatsapp_reminder_sent_at para citas pasadas.
 *
 * Cada bloque en su try/catch: un fallo en uno no afecta al otro.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const utcHour = new Date().getUTCHours();
  const report: {
    timestamp: string;
    utcHour: number;
    daily: unknown;
    reset: unknown;
  } = {
    timestamp: new Date().toISOString(),
    utcHour,
    daily: null,
    reset: null,
  };

  // 1) Email matinal — corre siempre, filtra internamente por TZ = 9:00
  //    ?force=true bypass del gate de hora local (para test manual)
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  try {
    report.daily = await sendDailyWhatsAppReminders({ force });
  } catch (err) {
    report.daily = { error: err instanceof Error ? err.message : "Error desconocido" };
  }

  // 2) Reset nocturno — solo a las 02:00 UTC
  if (utcHour === 2) {
    try {
      const cleared = await resetPastReminders();
      report.reset = { cleared };
    } catch (err) {
      report.reset = { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  } else {
    report.reset = { skipped: true };
  }

  return NextResponse.json({ ok: true, ...report });
}
