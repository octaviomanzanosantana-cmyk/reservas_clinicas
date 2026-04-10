import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { createClinicHour } from "@/lib/clinicHours";
import { NextResponse } from "next/server";

type CreateClinicHourRequest = {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  active?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateClinicHourRequest;
    const access = await requireCurrentClinicForApi();

    if (
      typeof body.day_of_week !== "number" ||
      body.day_of_week < 1 ||
      body.day_of_week > 7
    ) {
      return NextResponse.json({ error: "day_of_week inválido" }, { status: 400 });
    }

    const startTime = body.start_time?.trim() || "09:00";
    const endTime = body.end_time?.trim() || "14:00";

    const clinicHour = await createClinicHour({
      clinic_slug: access.clinicSlug,
      day_of_week: body.day_of_week,
      start_time: startTime,
      end_time: endTime,
      active: body.active ?? true,
    });

    return NextResponse.json({ clinicHour });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el tramo" },
      { status: 500 },
    );
  }
}
