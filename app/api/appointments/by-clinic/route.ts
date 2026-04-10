import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const access = await requireCurrentClinicForApi();

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, patient_email, patient_phone, service, scheduled_at, datetime_label, status, modality, appointment_type, video_link, review_sent_at, updated_at")
      .eq("clinic_id", access.clinicId)
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ appointments: data ?? [] });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron cargar las citas" },
      { status: 500 },
    );
  }
}
