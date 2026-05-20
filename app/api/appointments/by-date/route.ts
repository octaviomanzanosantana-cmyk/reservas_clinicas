import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

const MAX_RANGE_DAYS = 92;

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

// Días entre dos local-midnight Dates, inclusivo. Usa Date.UTC para evitar
// que DST (días de 23h o 25h) sesgue el conteo cuando from/to cruzan transición.
function daysBetweenInclusive(from: Date, to: Date): number {
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUTC - fromUTC) / 86_400_000) + 1;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date")?.trim();
    const fromParam = searchParams.get("from")?.trim();
    const toParam = searchParams.get("to")?.trim();

    const hasRange = Boolean(fromParam || toParam);

    if (hasRange) {
      if (!fromParam || !toParam) {
        return NextResponse.json(
          { error: "from y to son obligatorios juntos" },
          { status: 400 },
        );
      }
    } else if (!dateParam) {
      return NextResponse.json({ error: "date es requerido" }, { status: 400 });
    }

    const access = await requireCurrentClinicForApi();

    let startOfRange: Date;
    let endExclusive: Date;

    if (hasRange) {
      const from = parseDateParam(fromParam!);
      const to = parseDateParam(toParam!);

      if (!from || !to) {
        return NextResponse.json(
          { error: "from/to invalidos, usa YYYY-MM-DD" },
          { status: 400 },
        );
      }

      if (from.getTime() > to.getTime()) {
        return NextResponse.json(
          { error: "from debe ser <= to" },
          { status: 400 },
        );
      }

      const dayCount = daysBetweenInclusive(from, to);
      if (dayCount > MAX_RANGE_DAYS) {
        return NextResponse.json(
          { error: `rango maximo ${MAX_RANGE_DAYS} dias (recibido: ${dayCount})` },
          { status: 400 },
        );
      }

      startOfRange = new Date(from);
      startOfRange.setHours(0, 0, 0, 0);

      endExclusive = new Date(to);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
    } else {
      const date = parseDateParam(dateParam!);

      if (!date) {
        return NextResponse.json({ error: "date invalido, usa YYYY-MM-DD" }, { status: 400 });
      }

      startOfRange = new Date(date);
      startOfRange.setHours(0, 0, 0, 0);

      endExclusive = new Date(date);
      endExclusive.setDate(endExclusive.getDate() + 1);
      endExclusive.setHours(0, 0, 0, 0);
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, patient_email, patient_phone, service, scheduled_at, datetime_label, status, modality, appointment_type, video_link, updated_at")
      .gte("scheduled_at", startOfRange.toISOString())
      .lt("scheduled_at", endExclusive.toISOString())
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
