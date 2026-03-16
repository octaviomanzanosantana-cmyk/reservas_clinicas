import { getClinicBySlug } from "@/lib/clinics";
import {
  getGoogleCalendarAuthUrlByClinicId,
  isGoogleCalendarAuthorized,
} from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const clinic = await getClinicBySlug(clinicSlug);

    if (!clinic) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    const [url, authorized] = await Promise.all([
      getGoogleCalendarAuthUrlByClinicId(clinic.id),
      isGoogleCalendarAuthorized(clinicSlug),
    ]);

    return NextResponse.json({ url, authorized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar URL de autorización" },
      { status: 500 },
    );
  }
}
