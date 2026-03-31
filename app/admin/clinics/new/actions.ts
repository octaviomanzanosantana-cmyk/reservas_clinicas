"use server";

import { upsertClinicHour } from "@/lib/clinicHours";
import { provisionClinicUserAccess } from "@/lib/clinicUserProvisioning";
import { createClinic } from "@/lib/clinics";
import { createService } from "@/lib/services";

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

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type CreateClinicInput = {
  name: string;
  slug: string;
  phone: string;
  address: string;
  theme_color: string;
  description: string;
  access_email: string;
  seed_default_services: boolean;
  seed_default_hours: boolean;
};

type CreateClinicResult =
  | {
      ok: true;
      clinicSlug: string;
      access:
        | { attempted: false }
        | { attempted: true; success: boolean; email: string; error?: string };
    }
  | { ok: false; error: string };

export async function createClinicAction(
  input: CreateClinicInput,
): Promise<CreateClinicResult> {
  const name = input.name.trim();
  const slug = input.slug ? normalizeSlug(input.slug) : "";
  const phone = input.phone.trim();
  const address = input.address.trim();
  const themeColor = input.theme_color.trim();
  const accessEmail = input.access_email.trim().toLowerCase();

  if (!name || !slug || !phone || !address || !themeColor) {
    return { ok: false, error: "Faltan campos requeridos" };
  }

  try {
    const clinic = await createClinic({
      slug,
      name,
      description: input.description.trim() || null,
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

    if (input.seed_default_services) {
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

    if (input.seed_default_hours) {
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

    let access: CreateClinicResult & { ok: true } extends { access: infer A }
      ? A
      : never = { attempted: false };

    if (accessEmail) {
      try {
        const result = await provisionClinicUserAccess({
          email: accessEmail,
          clinicId: clinic.id,
        });
        access = {
          attempted: true,
          success: true,
          email: result.email,
        };
      } catch (error) {
        access = {
          attempted: true,
          success: false,
          email: accessEmail,
          error: error instanceof Error ? error.message : "Error desconocido",
        };
      }
    }

    return { ok: true, clinicSlug: clinic.slug, access };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear la clinica",
    };
  }
}
