import { assertCurrentClinicAccessForApi, ClinicAccessError } from "@/lib/clinicAuth";
import { getAppointmentByToken, type AppointmentRow } from "@/lib/appointments";
import { sendVideoLinkEmail } from "@/lib/appointmentEmails";
import { getClinicById } from "@/lib/clinics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type UpdatePatientRequest = {
  token?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  video_link?: string;
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
    const videoLink = body.video_link?.trim() || null;

    const updatePayload: Record<string, unknown> = {
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      updated_at: new Date().toISOString(),
    };

    // Only update video_link if explicitly provided in request
    if (typeof body.video_link === "string") {
      updatePayload.video_link = videoLink;
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(updatePayload)
      .eq("token", token)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    // Send video link email if link was added/changed and patient has email
    const isNewVideoLink = videoLink && videoLink !== (current.video_link ?? "");
    if (isNewVideoLink && (patientEmail ?? current.patient_email)) {
      try {
        const clinic = current.clinic_id ? await getClinicById(current.clinic_id) : null;
        await sendVideoLinkEmail(data as AppointmentRow, {
          videoLink,
          clinicName: clinic?.name ?? current.clinic_name,
          clinicPhone: clinic?.phone,
          timezone: clinic?.timezone,
        });
      } catch (emailError) {
        console.error("[update-patient] Failed to send video link email", {
          token,
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
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
