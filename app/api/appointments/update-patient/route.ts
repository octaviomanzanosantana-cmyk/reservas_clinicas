import { assertCurrentClinicAccessForApi, ClinicAccessError } from "@/lib/clinicAuth";
import { getAppointmentByToken } from "@/lib/appointments";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type UpdatePatientRequest = {
  token?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdatePatientRequest;
    const token = body.token?.trim().toLowerCase();

    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 });
    }

    const current = await getAppointmentByToken(token);
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    await assertCurrentClinicAccessForApi({ clinicId: current.clinic_id });

    const patientName = body.patient_name?.trim();
    if (!patientName) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const patientEmail = body.patient_email?.trim() || null;
    if (patientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 });
    }

    const patientPhone = body.patient_phone?.trim() || null;

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update({
        patient_name: patientName,
        patient_email: patientEmail,
        patient_phone: patientPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("token", token)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ appointment: data });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar" },
      { status: 500 },
    );
  }
}
