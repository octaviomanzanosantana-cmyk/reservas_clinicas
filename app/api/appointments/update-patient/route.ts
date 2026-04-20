import { assertCurrentClinicAccessForApi, ClinicAccessError } from "@/lib/clinicAuth";
import { getAppointmentByToken, type AppointmentRow } from "@/lib/appointments";
import { sendAppointmentRescheduledEmail, sendVideoLinkEmail } from "@/lib/appointmentEmails";
import { getClinicById, resolveClinicCopyEmail } from "@/lib/clinics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type UpdatePatientRequest = {
  token?: string;
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
  modality?: string;
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

    const modality = body.modality?.trim() || null;

    const updatePayload: Record<string, unknown> = {
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      updated_at: new Date().toISOString(),
    };

    if (modality) {
      updatePayload.modality = modality;
    }

    // Only update video_link if explicitly provided in request
    if (typeof body.video_link === "string") {
      updatePayload.video_link = videoLink;
    }

    // Clear video_link when switching to presencial
    if (modality === "presencial" && current.modality === "online") {
      updatePayload.video_link = null;
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(updatePayload)
      .eq("token", token)
      .select("*")
      .maybeSingle();

    // Propagate email change to all appointments of same patient in this clinic
    const oldEmail = current.patient_email?.trim().toLowerCase();
    const newEmail = patientEmail?.trim().toLowerCase();
    if (oldEmail && newEmail && oldEmail !== newEmail && current.clinic_id) {
      await supabaseAdmin
        .from("appointments")
        .update({ patient_email: patientEmail, updated_at: new Date().toISOString() })
        .eq("clinic_id", current.clinic_id)
        .ilike("patient_email", oldEmail)
        .neq("token", token);
    }

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

    // Send modality change email if modality changed
    const modalityChanged = modality && modality !== current.modality;
    if (modalityChanged && !isNewVideoLink && (patientEmail ?? current.patient_email)) {
      try {
        const clinic = current.clinic_id ? await getClinicById(current.clinic_id) : null;
        await sendAppointmentRescheduledEmail(data as AppointmentRow, {
          notificationEmail: resolveClinicCopyEmail(clinic),
          timezone: clinic?.timezone,
        });
      } catch (emailError) {
        console.error("[update-patient] Failed to send modality change email", {
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
