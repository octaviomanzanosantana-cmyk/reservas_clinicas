import { ClinicAccessError, requireCurrentClinicForApi } from "@/lib/clinicAuth";
import { getClinicBySlug } from "@/lib/clinics";
import { canUseFeature } from "@/lib/plan";
import { createService, getActiveServicesByClinicSlug } from "@/lib/services";
import { NextResponse } from "next/server";

type CreateServiceRequest = {
  clinic_slug?: string;
  name?: string;
  duration_minutes?: number;
  active?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateServiceRequest;
    const name = body.name?.trim();
    const durationMinutes = body.duration_minutes;
    const access = await requireCurrentClinicForApi();

    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }

    if (
      typeof durationMinutes !== "number" ||
      Number.isNaN(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return NextResponse.json({ error: "duration_minutes invalido" }, { status: 400 });
    }

    // Plan limit: free = max 1 active service
    const clinic = await getClinicBySlug(access.clinicSlug);
    if (clinic && !canUseFeature(clinic.plan as "free" | "starter" | "pro", "unlimited_services")) {
      const activeServices = await getActiveServicesByClinicSlug(access.clinicSlug);
      if (activeServices.length >= 1) {
        return NextResponse.json(
          {
            error: "plan_limit",
            message: "El plan Gratuito permite 1 servicio. Actualiza tu plan para añadir más.",
          },
          { status: 403 },
        );
      }
    }

    const service = await createService({
      clinic_slug: access.clinicSlug,
      name,
      duration_minutes: durationMinutes,
      active: body.active,
    });

    return NextResponse.json({ service });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el servicio" },
      { status: 500 },
    );
  }
}
