import { getAdminUser } from "@/lib/adminAuth";
import { sendClinicWelcomeEmail } from "@/lib/appointmentEmails";
import { createClinic, deleteClinicById, listClinics, listDemoClinics } from "@/lib/clinics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET — listar clínicas
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1";

  const clinics = all ? await listClinics() : await listDemoClinics();
  return NextResponse.json({ clinics });
}

// POST — crear demo
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      email?: string;
    };

    const name = body.name?.trim();
    const slug = body.slug ? normalizeSlug(body.slug) : "";
    const email = body.email?.trim().toLowerCase();

    if (!name || !slug || !email) {
      return NextResponse.json(
        { error: "name, slug y email son requeridos" },
        { status: 400 },
      );
    }

    // 1. Crear clínica
    const clinic = await createClinic({
      slug,
      name,
      description: `Clínica demo creada para ${email}`,
      address: null,
      phone: null,
      theme_color: "#0E9E82",
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

    // Marcar como demo
    await supabaseAdmin
      .from("clinics")
      .update({ is_demo: true })
      .eq("id", clinic.id);

    // Crear usuario + membership + email de bienvenida
    let accessResult: { success: boolean; error?: string } = { success: false };
    try {
      // Crear usuario con contraseña temporal
      const tempPassword = crypto.randomUUID();
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        });

      if (authError || !authData.user) {
        throw new Error(authError?.message ?? "No se pudo crear el usuario");
      }

      // Vincular usuario ↔ clínica
      await supabaseAdmin.from("clinic_users").insert({
        clinic_id: clinic.id,
        user_id: authData.user.id,
        role: "owner",
      });

      // Generar link de reset password
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: "https://app.appoclick.com/reset-password",
          },
        });

      if (linkError) {
        throw new Error(linkError.message);
      }

      const activationUrl = linkData.properties?.action_link ?? "";

      // Enviar email de bienvenida via Resend
      await sendClinicWelcomeEmail(email, name!, {
        invited: true,
        passwordResetUrl: activationUrl ?? undefined,
      });

      accessResult = { success: true };
    } catch (error) {
      accessResult = {
        success: false,
        error: error instanceof Error ? error.message : "Error al crear acceso",
      };
    }

    return NextResponse.json({
      clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
      access: accessResult,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la demo" },
      { status: 500 },
    );
  }
}

// DELETE — eliminar demo
export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { clinic_id?: string };
    const clinicId = body.clinic_id?.trim();

    if (!clinicId) {
      return NextResponse.json({ error: "clinic_id requerido" }, { status: 400 });
    }

    await deleteClinicById(clinicId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar" },
      { status: 500 },
    );
  }
}
