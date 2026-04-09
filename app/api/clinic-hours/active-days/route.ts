import { getClinicHoursByClinicSlug } from "@/lib/clinicHours";
import { NextResponse } from "next/server";

/**
 * Public endpoint — returns active day_of_week numbers (1=Mon..7=Sun) for a clinic.
 * Used by the public booking calendar to disable days without schedule.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const hours = await getClinicHoursByClinicSlug(clinicSlug);
    const activeDays = [...new Set(hours.map((h) => h.day_of_week))].sort();

    return NextResponse.json({ activeDays });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error" },
      { status: 500 },
    );
  }
}
