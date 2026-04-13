import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type DeletePatientRequest = {
  patient_email?: string;
};

export async function POST(request: Request) {
  try {
    const access = await requireCurrentClinicForApi();
    const body = (await request.json()) as DeletePatientRequest;
    const email = body.patient_email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "patient_email es requerido" }, { status: 400 });
    }

    // Delete all appointments for this email in this clinic
    const { error: deleteError, count } = await supabaseAdmin
      .from("appointments")
      .delete({ count: "exact" })
      .eq("clinic_id", access.clinicId)
      .ilike("patient_email", email);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    // Log the deletion
    await supabaseAdmin.from("patient_deletion_log").insert({
      clinic_id: access.clinicId,
      patient_email: email,
      deleted_by: access.userId,
    });

    return NextResponse.json({ ok: true, deleted: count ?? 0 });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 500 },
    );
  }
}
