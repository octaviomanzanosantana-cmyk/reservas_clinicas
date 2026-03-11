import { updateServiceById } from "@/lib/services";
import { NextResponse } from "next/server";

type UpdateServiceRequest = {
  id?: string;
  name?: string;
  duration_minutes?: number;
  active?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateServiceRequest;
    const id = body.id?.trim();

    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    if (
      body.duration_minutes !== undefined &&
      (typeof body.duration_minutes !== "number" ||
        Number.isNaN(body.duration_minutes) ||
        body.duration_minutes <= 0)
    ) {
      return NextResponse.json({ error: "duration_minutes inválido" }, { status: 400 });
    }

    const service = await updateServiceById(id, {
      name: body.name,
      duration_minutes: body.duration_minutes,
      active: body.active,
    });

    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ service });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el servicio" },
      { status: 500 },
    );
  }
}
