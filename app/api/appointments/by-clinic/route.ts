import { getClinicBySlug } from "@/lib/clinics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();
    const clinicName = searchParams.get("clinicName")?.trim();

    if (!clinicSlug && !clinicName) {
      return NextResponse.json({ error: "clinicSlug o clinicName es requerido" }, { status: 400 });
    }

    const clinicRow = clinicSlug ? await getClinicBySlug(clinicSlug) : null;
    if (clinicSlug && !clinicRow?.id) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    let appointmentsQuery = supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, patient_phone, service, scheduled_at, datetime_label, status, updated_at")
      .order("scheduled_at", { ascending: true })
      .limit(50);
    if (clinicRow?.id) {
      appointmentsQuery = appointmentsQuery.eq("clinic_id", clinicRow.id);
    } else if (clinicName) {
      appointmentsQuery = appointmentsQuery.eq("clinic_name", clinicName);
    }

    const { data, error } = await appointmentsQuery;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ appointments: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las citas" },
      { status: 500 },
    );
  }
}
