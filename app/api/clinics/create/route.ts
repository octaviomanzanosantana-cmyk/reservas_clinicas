import { upsertClinicHour } from "@/lib/clinicHours";
import { createClinic } from "@/lib/clinics";
import { createService } from "@/lib/services";
import { NextResponse } from "next/server";

type CreateClinicRequest = {
  name?: string;
  slug?: string;
  phone?: string;
  address?: string;
  theme_color?: string;
  description?: string | null;
  seed_default_services?: boolean;
  seed_default_hours?: boolean;
};

const DEFAULT_SERVICES = [
  { name: "Primera consulta", duration_minutes: 30 },
  { name: "Revisión", duration_minutes: 20 },
  { name: "Seguimiento", duration_minutes: 30 },
];

const DEFAULT_HOURS = [
  { day_of_week: 1, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 2, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 3, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 4, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 5, start_time: "09:00", end_time: "18:00", active: true },
];

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateClinicRequest;
    const name = body.name?.trim();
    const slug = body.slug ? normalizeSlug(body.slug) : "";
    const phone = body.phone?.trim();
    const address = body.address?.trim();
    const themeColor = body.theme_color?.trim();

    if (!name) {
      return NextResponse.json({ error: "name es requerido" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
    }

    if (!address) {
      return NextResponse.json({ error: "address es requerido" }, { status: 400 });
    }

    if (!themeColor) {
      return NextResponse.json({ error: "theme_color es requerido" }, { status: 400 });
    }

    const clinic = await createClinic({
      slug,
      name,
      description: body.description ?? null,
      address,
      phone,
      theme_color: themeColor,
      booking_enabled: true,
      logo_url: null,
    });

    if (body.seed_default_services) {
      await Promise.all(
        DEFAULT_SERVICES.map((service) =>
          createService({
            clinic_slug: clinic.slug,
            name: service.name,
            duration_minutes: service.duration_minutes,
            active: true,
          }),
        ),
      );
    }

    if (body.seed_default_hours) {
      await Promise.all(
        DEFAULT_HOURS.map((hour) =>
          upsertClinicHour({
            clinic_slug: clinic.slug,
            day_of_week: hour.day_of_week,
            start_time: hour.start_time,
            end_time: hour.end_time,
            active: hour.active,
          }),
        ),
      );
    }

    return NextResponse.json({ clinic });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la clínica" },
      { status: 500 },
    );
  }
}
