import { NextRequest, NextResponse } from "next/server";

import {
  ClinicUserProvisioningError,
  provisionClinicUserAccess,
} from "@/lib/clinicUserProvisioning";

type CreateClinicUserBody = {
  email?: unknown;
  clinic_id?: unknown;
};

const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET?.trim();

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeClinicId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  if (!ADMIN_API_SECRET) {
    return NextResponse.json(
      { error: "Missing ADMIN_API_SECRET" },
      { status: 500 },
    );
  }

  const providedSecret = request.headers.get("x-admin-secret")?.trim();
  if (!providedSecret || providedSecret !== ADMIN_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateClinicUserBody;

  try {
    body = (await request.json()) as CreateClinicUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const clinicId = normalizeClinicId(body.clinic_id);

  if (!email || !clinicId) {
    return NextResponse.json(
      { error: "email and clinic_id are required" },
      { status: 400 },
    );
  }

  try {
    const result = await provisionClinicUserAccess({
      email,
      clinicId,
    });

    return NextResponse.json(
      {
        ok: true,
        user_id: result.userId,
        email: result.email,
        clinic_id: result.clinicId,
        clinic_slug: result.clinicSlug,
        user_created: result.userCreated,
        clinic_link_created: result.clinicLinkCreated,
        recovery_email_sent: result.recoveryEmailSent,
        recovery_redirect_to: result.recoveryRedirectTo,
      },
      { status: result.userCreated || result.clinicLinkCreated ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof ClinicUserProvisioningError) {
      return NextResponse.json(
        {
          error: error.message,
          ...error.details,
        },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
