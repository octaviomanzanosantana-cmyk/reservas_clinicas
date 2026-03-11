import { upsertClinicHour } from "@/lib/clinicHours";
import { NextResponse } from "next/server";

type UpdateClinicHourRequest = {
  clinic_slug?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  active?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateClinicHourRequest;
    const clinicSlug = body.clinic_slug?.trim();

    if (!clinicSlug) {
      return NextResponse.json({ error: "clinic_slug es requerido" }, { status: 400 });
    }

    if (
      typeof body.day_of_week !== "number" ||
      Number.isNaN(body.day_of_week) ||
      body.day_of_week < 1 ||
      body.day_of_week > 7
    ) {
      return NextResponse.json({ error: "day_of_week inválido" }, { status: 400 });
    }

    if (body.active === true && (!body.start_time || !body.end_time)) {
      return NextResponse.json(
        { error: "start_time y end_time son requeridos" },
        { status: 400 },
      );
    }

    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active es requerido" }, { status: 400 });
    }

    const startTime = body.start_time ?? "09:00";
    const endTime = body.end_time ?? "18:00";

    const clinicHour = await upsertClinicHour({
      clinic_slug: clinicSlug,
      day_of_week: body.day_of_week,
      start_time: startTime,
      end_time: endTime,
      active: body.active,
    });

    return NextResponse.json({ clinicHour });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el horario" },
      { status: 500 },
    );
  }
}
