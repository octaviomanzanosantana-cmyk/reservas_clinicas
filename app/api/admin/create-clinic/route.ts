import { NextResponse } from "next/server";

import { upsertClinicHour } from "@/lib/clinicHours";
import { provisionClinicUserAccess } from "@/lib/clinicUserProvisioning";
import { createClinic } from "@/lib/clinics";
import { createService } from "@/lib/services";

type CreateClinicRequest = {
  name?: string;
  slug?: string;
  phone?: string;
  address?: string;
  theme_color?: string;
  description?: string | null;
  seed_default_services?: boolean;
  seed_default_hours?: boolean;
  access_email?: string | null;
};

const DEFAULT_SERVICES = [
  { name: "Primera consulta", duration_minutes: 30 },
  { name: "Revision", duration_minutes: 20 },
  { name: "Seguimiento", duration_minutes: 30 },
];

const DEFAULT_HOURS = [
  { day_of_week: 1, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 2, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 3, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 4, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 5, start_time: "09:00", end_time: "18:00", active: true },
];

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET?.trim();

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  // Protegido: requiere ADMIN_API_SECRET via header o que exista la cookie de sesión
  // En producción, este endpoint solo es accesible via la UI admin interna
  if (!ADMIN_API_SECRET) {
    return NextResponse.json({ error: "Missing ADMIN_API_SECRET" }, { status: 500 });
  }

  const providedSecret = request.headers.get("x-admin-secret")?.trim();
  if (!providedSecret || providedSecret !== ADMIN_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateClinicRequest;
    const name = body.name?.trim();
    const slug = body.slug ? normalizeSlug(body.slug) : "";
    const phone = body.phone?.trim();
    const address = body.address?.trim();
    const themeColor = body.theme_color?.trim();
    const accessEmail = body.access_email?.trim().toLowerCase() || "";

    if (!name || !slug || !phone || !address || !themeColor) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const clinic = await createClinic({
      slug,
      name,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      address,
      phone,
      theme_color: themeColor,
      booking_enabled: true,
      google_connected: false,
      google_email: null,
      google_refresh_token: null,
      google_calendar_id: null,
      google_token_scope: null,
      google_token_type: null,
      google_token_expires_at: null,
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

    let access:
      | { attempted: false }
      | { attempted: true; success: boolean; email: string; error?: string } = { attempted: false };

    if (accessEmail) {
      try {
        const result = await provisionClinicUserAccess({
          email: accessEmail,
          clinicId: clinic.id,
        });
        access = { attempted: true, success: true, email: result.email };
      } catch (error) {
        access = {
          attempted: true,
          success: false,
          email: accessEmail,
          error: error instanceof Error ? error.message : "Error desconocido",
        };
      }
    }

    return NextResponse.json({ clinic, access }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la clinica" },
      { status: 500 },
    );
  }
}
