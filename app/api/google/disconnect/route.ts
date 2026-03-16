import { disconnectGoogleCalendar } from "@/lib/googleCalendar";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { clinicSlug?: string };
    const clinicSlug = body.clinicSlug?.trim() || PANEL_CLINIC_SLUG;
    await disconnectGoogleCalendar(clinicSlug);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo desconectar Google Calendar" },
      { status: 500 },
    );
  }
}
