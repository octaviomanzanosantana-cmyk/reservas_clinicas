import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type UpdateAppointmentStatusRequest = {
  token?: string;
  status?: "confirmed" | "cancelled" | "completed";
};

const VALID_STATUSES = new Set(["confirmed", "cancelled", "completed"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateAppointmentStatusRequest;
    const token = body.token?.trim().toLowerCase();

    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 });
    }

    if (!body.status || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq("token", token)
      .select("*")
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ appointment: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la cita" },
      { status: 500 },
    );
  }
}
