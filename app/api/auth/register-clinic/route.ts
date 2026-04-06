import { sendClinicWelcomeEmail } from "@/lib/appointmentEmails";
import { upsertClinicHour } from "@/lib/clinicHours";
import { createClinic, getClinicBySlug } from "@/lib/clinics";
import { createService } from "@/lib/services";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

type RegisterClinicRequest = {
  name?: string;
  email?: string;
  password?: string;
  is_demo?: boolean;
  invited?: boolean;
};

const BASE_SERVICES = [
  { name: "Primera consulta", duration_minutes: 60 },
  { name: "Consulta de seguimiento", duration_minutes: 30 },
  { name: "Sesión de tratamiento", duration_minutes: 45 },
];

const BASE_HOURS = [
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

async function findUniqueSlug(base: string): Promise<string> {
  let slug = normalizeSlug(base);
  let suffix = 1;
  while (await getClinicBySlug(slug)) {
    suffix++;
    slug = `${normalizeSlug(base)}-${suffix}`;
  }
  return slug;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterClinicRequest;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const isDemo = body.is_demo ?? false;
    const isInvited = body.invited ?? false;

    if (!name || !email) {
      return NextResponse.json({ error: "Nombre y email son requeridos" }, { status: 400 });
    }

    if (!isInvited && (!password || password.length < 8)) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    // 1. Crear usuario en Supabase Auth
    let userId: string;
    let activationUrl: string | null = null;

    if (isInvited) {
      // Flujo admin: contraseña temporal + magic link
      const tempPassword = crypto.randomUUID();
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (error || !data.user) {
        if (error?.message?.includes("already been registered")) {
          return NextResponse.json({ error: "Este email ya tiene una cuenta" }, { status: 409 });
        }
        throw new Error(error?.message ?? "No se pudo crear el usuario");
      }
      userId = data.user.id;

      // Generar link de activación
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: "https://app.appoclick.com/reset-password" },
      });
      if (!linkError) {
        activationUrl = linkData.properties?.action_link ?? null;
      }
    } else {
      // Flujo autoservicio: contraseña real
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: password!,
        email_confirm: true,
      });
      if (error || !data.user) {
        if (error?.message?.includes("already been registered")) {
          return NextResponse.json({ error: "Este email ya tiene una cuenta" }, { status: 409 });
        }
        throw new Error(error?.message ?? "No se pudo crear el usuario");
      }
      userId = data.user.id;
    }

    // 2. Crear clínica
    const slug = await findUniqueSlug(name);
    const clinic = await createClinic({
      slug,
      name,
      description: null,
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

    // Marcar como demo si corresponde
    if (isDemo) {
      await supabaseAdmin.from("clinics").update({ is_demo: true }).eq("id", clinic.id);
    }

    // 3. Vincular usuario ↔ clínica
    await supabaseAdmin.from("clinic_users").insert({
      clinic_id: clinic.id,
      user_id: userId,
      role: "owner",
    });

    // 4. Servicios base
    await Promise.all(
      BASE_SERVICES.map((s) =>
        createService({ clinic_slug: clinic.slug, name: s.name, duration_minutes: s.duration_minutes, active: true }),
      ),
    );

    // 5. Horario base L-V
    await Promise.all(
      BASE_HOURS.map((h) =>
        upsertClinicHour({ clinic_slug: clinic.slug, ...h }),
      ),
    );

    // 6. Email de bienvenida
    try {
      if (isInvited) {
        await sendClinicWelcomeEmail(email, name!, {
          invited: true,
          passwordResetUrl: activationUrl ?? undefined,
        });
      } else {
        await sendClinicWelcomeEmail(email, name!);
      }
    } catch (emailErr) {
      console.error("[register-clinic] Welcome email failed", emailErr);
    }

    return NextResponse.json({
      clinic: { id: clinic.id, slug: clinic.slug, name: clinic.name },
      userId,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al crear la cuenta" },
      { status: 500 },
    );
  }
}
