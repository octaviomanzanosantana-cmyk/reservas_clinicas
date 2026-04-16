import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
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
    const dateParam = searchParams.get("date")?.trim();

    if (!dateParam) {
      return NextResponse.json({ error: "date es requerido" }, { status: 400 });
    }

    const access = await requireCurrentClinicForApi();
    const date = parseDateParam(dateParam);

    if (!date) {
      return NextResponse.json({ error: "date invalido, usa YYYY-MM-DD" }, { status: 400 });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfNextDay = new Date(date);
    endOfNextDay.setDate(endOfNextDay.getDate() + 1);
    endOfNextDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, patient_phone, service, scheduled_at, datetime_label, status, modality, appointment_type, updated_at")
      .gte("scheduled_at", startOfDay.toISOString())
      .lt("scheduled_at", endOfNextDay.toISOString())
      .eq("clinic_id", access.clinicId)
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: true });

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
