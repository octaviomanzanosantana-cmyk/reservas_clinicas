import { getClinicHoursConfigByClinicSlug } from "@/lib/clinicHours";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const clinicHours = await getClinicHoursConfigByClinicSlug(clinicSlug);
    return NextResponse.json({ clinicHours });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los horarios" },
      { status: 500 },
    );
  }
}
