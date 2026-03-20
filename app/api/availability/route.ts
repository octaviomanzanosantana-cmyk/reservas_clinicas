import {
  getAvailableSlotsForDate,
  getBusyRangesFromAppointments,
} from "@/lib/availability";
import {
  getAvailableSlotsForClinicDate,
  getClinicSlugForAppointmentToken,
} from "@/lib/clinicAvailability";
import { getClinicBySlug } from "@/lib/clinics";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

type AvailabilityAppointmentRow = {
  scheduled_at: string | null;
  duration_label: string | null;
  token: string | null;
  status: string | null;
};

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
    const dateParam = searchParams.get("date");
    const excludeToken = searchParams.get("excludeToken") ?? undefined;
    const clinicSlugParam = searchParams.get("clinicSlug")?.trim();
    const service = searchParams.get("service")?.trim();

    if (!dateParam) {
      return NextResponse.json({ error: "date es requerido" }, { status: 400 });
    }

    const date = parseDateParam(dateParam);
    if (!date) {
      return NextResponse.json({ error: "date invalido, usa YYYY-MM-DD" }, { status: 400 });
    }

    const resolvedClinicSlug =
      clinicSlugParam || (excludeToken ? await getClinicSlugForAppointmentToken(excludeToken) : null);

    if (resolvedClinicSlug) {
      const clinic = await getClinicBySlug(resolvedClinicSlug);
      if (!clinic?.id) {
        return NextResponse.json({ error: "Clinica no encontrada" }, { status: 404 });
      }

      const slots = await getAvailableSlotsForClinicDate({
        clinicSlug: resolvedClinicSlug,
        date,
        service,
        excludeToken,
      });

      return NextResponse.json({ slots });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfNextDay = new Date(date);
    endOfNextDay.setDate(endOfNextDay.getDate() + 1);
    endOfNextDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_label, token, status")
      .gte("scheduled_at", startOfDay.toISOString())
      .lt("scheduled_at", endOfNextDay.toISOString());

    if (error) {
      throw new Error(error.message);
    }

    const busyRanges = getBusyRangesFromAppointments({
      date,
      appointments: (data ?? []) as AvailabilityAppointmentRow[],
      excludeToken,
    });

    const slots = getAvailableSlotsForDate({
      date,
      busyRanges,
    });

    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo calcular disponibilidad" },
      { status: 500 },
    );
  }
}
