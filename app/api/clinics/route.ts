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
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la clínica" },
      { status: 500 },
    );
  }
}
