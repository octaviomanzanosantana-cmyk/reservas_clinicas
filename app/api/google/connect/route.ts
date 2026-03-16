import { getGoogleCalendarAuthUrl } from "@/lib/googleCalendar";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim() || PANEL_CLINIC_SLUG;
    const url = await getGoogleCalendarAuthUrl(clinicSlug);
    return NextResponse.redirect(url);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo iniciar Google OAuth" },
      { status: 500 },
    );
  }
}
