import { ClinicAccessError, assertCurrentClinicAccessForApi } from "@/lib/clinicAuth";
import { updateClinicBySlug } from "@/lib/clinics";
import { NextResponse } from "next/server";

type UpdateClinicRequest = {
  slug?: string;
  name?: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  theme_color?: string | null;
  booking_enabled?: boolean;
  google_connected?: boolean;
  google_email?: string | null;
  google_refresh_token?: string | null;
  google_calendar_id?: string | null;
  google_token_scope?: string | null;
  google_token_type?: string | null;
  google_token_expires_at?: string | null;
  notification_email?: string | null;
  review_url?: string | null;
  reminder_hours?: number;
  offers_presencial?: boolean;
  offers_online?: boolean;
  logo_has_dark_bg?: boolean;
  timezone?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateClinicRequest;
    const slug = body.slug?.trim();

    if (!slug) {
      return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
    }

    const access = await assertCurrentClinicAccessForApi({ clinicSlug: slug });
    const clinic = await updateClinicBySlug(access.clinicSlug, {
      name: body.name,
      description: body.description,
      address: body.address,
      phone: body.phone,
      logo_url: body.logo_url,
      theme_color: body.theme_color,
      booking_enabled: body.booking_enabled,
      google_connected: body.google_connected,
      google_email: body.google_email,
      google_refresh_token: body.google_refresh_token,
      google_calendar_id: body.google_calendar_id,
      google_token_scope: body.google_token_scope,
      google_token_type: body.google_token_type,
      google_token_expires_at: body.google_token_expires_at,
      notification_email: body.notification_email,
      review_url: body.review_url,
      reminder_hours: body.reminder_hours,
      offers_presencial: body.offers_presencial,
      offers_online: body.offers_online,
      logo_has_dark_bg: body.logo_has_dark_bg,
      timezone: body.timezone,
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ clinic });
  } catch (error) {
    if (error instanceof ClinicAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la clinica" },
      { status: 500 },
    );
  }
}
