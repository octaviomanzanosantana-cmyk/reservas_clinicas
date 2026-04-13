import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const access = await requireCurrentClinicForApi();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const service = searchParams.get("service")?.trim() || "";
    const modality = searchParams.get("modality")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;

    let query = supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, patient_email, patient_phone, service, scheduled_at, datetime_label, status, modality, appointment_type, video_link, review_sent_at, updated_at", { count: "exact" })
      .eq("clinic_id", access.clinicId)
      .order("scheduled_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (q) {
      query = query.or(`patient_name.ilike.%${q}%,patient_email.ilike.%${q}%`);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (service) {
      query = query.eq("service", service);
    }
    if (modality) {
      query = query.eq("modality", modality);
    }
    if (dateFrom) {
      query = query.gte("scheduled_at", `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte("scheduled_at", `${dateTo}T23:59:59`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      appointments: data ?? [],
      total: count ?? 0,
      page,
      perPage,
      totalPages: Math.ceil((count ?? 0) / perPage),
    });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error de búsqueda" },
      { status: 500 },
    );
  }
}
