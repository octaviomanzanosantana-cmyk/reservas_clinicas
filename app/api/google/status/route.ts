import { isGoogleCalendarAuthorized } from "@/lib/googleCalendar";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const authorized = await isGoogleCalendarAuthorized();
    return NextResponse.json({ authorized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo validar la autorización" },
      { status: 500 },
    );
  }
}
