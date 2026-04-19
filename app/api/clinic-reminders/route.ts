import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { getUpcomingReminders } from "@/lib/whatsappReminders";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();
    if (!clinicSlug) {
      return NextResponse.json({ error: "clinicSlug es requerido" }, { status: 400 });
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug });
    const reminders = await getUpcomingReminders(access.clinicId);
    return NextResponse.json({ reminders });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar los recordatorios" },
      { status: 500 },
    );
  }
}
