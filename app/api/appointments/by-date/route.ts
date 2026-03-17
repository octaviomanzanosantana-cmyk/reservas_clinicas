import { getClinicBySlug } from "@/lib/clinics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

function parseDateParam(dateParam: string): Date | null {
  const match = dateParam.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicSlug = searchParams.get("clinicSlug")?.trim();
    const clinicName = searchParams.get("clinicName")?.trim();
    const dateParam = searchParams.get("date")?.trim();

    if (!clinicSlug && !clinicName) {
      return NextResponse.json({ error: "clinicSlug o clinicName es requerido" }, { status: 400 });
    }

    if (!dateParam) {
      return NextResponse.json({ error: "date es requerido" }, { status: 400 });
    }

    const date = parseDateParam(dateParam);
    if (!date) {
      return NextResponse.json({ error: "date inválido, usa YYYY-MM-DD" }, { status: 400 });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfNextDay = new Date(date);
    endOfNextDay.setDate(endOfNextDay.getDate() + 1);
    endOfNextDay.setHours(0, 0, 0, 0);

    const clinicRow = clinicSlug ? await getClinicBySlug(clinicSlug) : null;
    if (clinicSlug && !clinicRow?.id) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    let appointmentsQuery = supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, patient_phone, service, scheduled_at, datetime_label, status, updated_at")
      .gte("scheduled_at", startOfDay.toISOString())
      .lt("scheduled_at", endOfNextDay.toISOString())
      .order("scheduled_at", { ascending: true });
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
