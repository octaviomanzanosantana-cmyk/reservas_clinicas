import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { updateClinicHour, upsertClinicHour } from "@/lib/clinicHours";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type UpdateClinicHourRequest = {
  id?: string;
  clinic_slug?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  active?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateClinicHourRequest;
    const access = await requireCurrentClinicForApi();

    // New path: update by ID
    if (body.id) {
      const { data: hour } = await supabaseAdmin
        .from("clinic_hours")
        .select("clinic_slug")
        .eq("id", body.id)
        .maybeSingle();

      if (!hour || hour.clinic_slug !== access.clinicSlug) {
        return NextResponse.json({ error: "Tramo no encontrado" }, { status: 404 });
      }

      const clinicHour = await updateClinicHour(body.id, {
        start_time: body.start_time,
        end_time: body.end_time,
        active: body.active,
      });

      return NextResponse.json({ clinicHour });
    }

    // Legacy path: upsert by day_of_week (backwards compatible)
    if (
      typeof body.day_of_week !== "number" ||
      body.day_of_week < 1 ||
      body.day_of_week > 7
    ) {
      return NextResponse.json({ error: "day_of_week invalido" }, { status: 400 });
    }

    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active es requerido" }, { status: 400 });
    }

    const clinicHour = await upsertClinicHour({
      clinic_slug: access.clinicSlug,
      day_of_week: body.day_of_week,
      start_time: body.start_time ?? "09:00",
      end_time: body.end_time ?? "18:00",
      active: body.active,
    });

    return NextResponse.json({ clinicHour });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el horario" },
      { status: 500 },
    );
  }
}
