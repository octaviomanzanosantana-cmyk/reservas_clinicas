import { expandBlocksToDates, listClinicBlocksInRange } from "@/lib/clinicBlocks";
import { getClinicHoursByClinicSlug } from "@/lib/clinicHours";
import { getClinicBySlug } from "@/lib/clinics";
import { NextResponse } from "next/server";

/**
 * Public endpoint — returns:
 *  - activeDays: números de día de la semana (1=Lun..7=Dom) con horario configurado
 *  - blockedDates: fechas YYYY-MM-DD en los próximos 120 días que caen dentro
 *    de algún bloqueo (vacaciones, etc.)
 *
 * Usado por el calendario público para desactivar días sin horario o con bloqueo.
 */
const BLOCK_HORIZON_DAYS = 120;

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const hours = await getClinicHoursByClinicSlug(clinicSlug);
    const activeDays = [...new Set(hours.map((h) => h.day_of_week))].sort();

    const clinic = await getClinicBySlug(clinicSlug);
    let blockedDates: string[] = [];
    if (clinic?.id) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + BLOCK_HORIZON_DAYS);
      const rangeStart = toDateString(today);
      const rangeEnd = toDateString(horizon);
      const blocks = await listClinicBlocksInRange(clinic.id, rangeStart, rangeEnd);
      blockedDates = expandBlocksToDates(blocks, rangeStart, rangeEnd);
    }

    return NextResponse.json({ activeDays, blockedDates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
