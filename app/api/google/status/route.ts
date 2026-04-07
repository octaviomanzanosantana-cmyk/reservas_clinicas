import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { getClinicBySlug } from "@/lib/clinics";
import { isGoogleCalendarAuthorized } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug });
    const clinic = await getClinicBySlug(access.clinicSlug);

    if (!clinic) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    const authorized = await isGoogleCalendarAuthorized(access.clinicSlug);
    return NextResponse.json({
      connected: clinic.google_connected,
      authorized,
      email: clinic.google_email,
    });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo validar la autorizacion" },
      { status: 500 },
    );
  }
}
