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
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpdateClinicRequest;
    const slug = body.slug?.trim();

    if (!slug) {
      return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
    }

    const clinic = await updateClinicBySlug(slug, {
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
    });

    if (!clinic) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ clinic });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la clínica" },
      { status: 500 },
    );
  }
}
