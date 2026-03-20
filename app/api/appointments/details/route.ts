import { getAppointmentByToken } from "@/lib/appointments";
import { getPatientAppointmentDetails } from "@/lib/patientContext";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json({ error: "token es requerido" }, { status: 400 });
    }

    const appointment = await getAppointmentByToken(token);

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const details = await getPatientAppointmentDetails(appointment);
    return NextResponse.json(details);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la cita" },
      { status: 500 },
    );
  }
}
