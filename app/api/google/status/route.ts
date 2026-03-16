import { getClinicBySlug } from "@/lib/clinics";
import { isGoogleCalendarAuthorized } from "@/lib/googleCalendar";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim() || PANEL_CLINIC_SLUG;
    const clinic = await getClinicBySlug(clinicSlug);

    if (!clinic) {
      return NextResponse.json({ error: "ClÃ­nica no encontrada" }, { status: 404 });
    }

    const authorized = await isGoogleCalendarAuthorized(clinicSlug);
    return NextResponse.json({
      connected: clinic.google_connected,
      authorized,
      email: clinic.google_email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo validar la autorización" },
      { status: 500 },
    );
  }
}
