import { getClinicBySlug } from "@/lib/clinics";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug")?.trim();

    if (!slug) {
      return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
    }

    const clinic = await getClinicBySlug(slug);

    if (!clinic) {
      return NextResponse.json({ error: "Clínica no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      clinic: {
        id: clinic.id,
        slug: clinic.slug,
        name: clinic.name,
        description: clinic.description,
        address: clinic.address,
        phone: clinic.phone,
        logo_url: clinic.logo_url,
        theme_color: clinic.theme_color,
        booking_enabled: clinic.booking_enabled,
        review_url: clinic.review_url,
        notification_email: clinic.notification_email,
        reminder_hours: clinic.reminder_hours,
        offers_presencial: clinic.offers_presencial,
        offers_online: clinic.offers_online,
        logo_has_dark_bg: clinic.logo_has_dark_bg,
        timezone: clinic.timezone,
        plan: clinic.plan ?? "free",
        dpa_accepted_at: clinic.dpa_accepted_at ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la clínica" },
      { status: 500 },
    );
  }
}
