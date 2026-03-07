import { getGoogleCalendarAuthUrl, isGoogleCalendarAuthorized } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [url, authorized] = await Promise.all([
      getGoogleCalendarAuthUrl(),
      isGoogleCalendarAuthorized(),
    ]);
    return NextResponse.json({ url, authorized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar URL de autorización" },
      { status: 500 },
    );
  }
}
