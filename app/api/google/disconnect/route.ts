import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { disconnectGoogleCalendar } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const access = await requireCurrentClinicForApi();
    await disconnectGoogleCalendar(access.clinicSlug);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo desconectar Google Calendar" },
      { status: 500 },
    );
  }
}
