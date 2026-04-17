import { NextRequest, NextResponse } from "next/server";

import { provisionClinicUserAccess } from "@/lib/clinicUserProvisioning";
import { createClinic } from "@/lib/clinics";

type CreateClinicRequest = {
  name?: string;
  slug?: string;
  phone?: string;
  address?: string;
  theme_color?: string;
  description?: string | null;
  access_email?: string | null;
};

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET?.trim();

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  if (!ADMIN_API_SECRET) {
    return NextResponse.json(
      { error: "Missing ADMIN_API_SECRET configuration" },
      { status: 500 },
    );
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
      google_connected: false,
      google_email: null,
      google_refresh_token: null,
      google_calendar_id: null,
      google_token_scope: null,
      google_token_type: null,
      google_token_expires_at: null,
      logo_url: null,
    });

    let access:
      | { attempted: false }
      | {
          attempted: true;
          success: boolean;
          email: string;
          user_created?: boolean;
          clinic_link_created?: boolean;
          recovery_email_sent?: boolean;
          error?: string;
        } = { attempted: false };

    if (accessEmail) {
      try {
        const accessResult = await provisionClinicUserAccess({
          email: accessEmail,
          clinicId: clinic.id,
        });

        access = {
          attempted: true,
          success: true,
          email: accessResult.email,
          user_created: accessResult.userCreated,
          clinic_link_created: accessResult.clinicLinkCreated,
          recovery_email_sent: accessResult.recoveryEmailSent,
        };
      } catch (error) {
        access = {
          attempted: true,
          success: false,
          email: accessEmail,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo crear el acceso principal",
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
