import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clinicName = searchParams.get("clinicName")?.trim();

    if (!clinicName) {
      return NextResponse.json({ error: "clinicName es requerido" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id, token, patient_name, service, scheduled_at, datetime_label, status, updated_at")
      .eq("clinic_name", clinicName)
      .order("scheduled_at", { ascending: true })
      .limit(50);

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
