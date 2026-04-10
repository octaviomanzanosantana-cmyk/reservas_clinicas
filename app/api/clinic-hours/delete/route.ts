import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { deleteClinicHour } from "@/lib/clinicHours";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type DeleteClinicHourRequest = {
  id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DeleteClinicHourRequest;
    const access = await requireCurrentClinicForApi();
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    // Verify the hour belongs to this clinic
    const { data: hour } = await supabaseAdmin
      .from("clinic_hours")
      .select("clinic_slug")
      .eq("id", id)
      .maybeSingle();

    if (!hour || hour.clinic_slug !== access.clinicSlug) {
      return NextResponse.json({ error: "Tramo no encontrado" }, { status: 404 });
    }

    await deleteClinicHour(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el tramo" },
      { status: 500 },
    );
  }
}
