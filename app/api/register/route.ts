import { NextRequest, NextResponse } from "next/server";

import { upsertClinicHour } from "@/lib/clinicHours";
import { createClinic } from "@/lib/clinics";
import { createService } from "@/lib/services";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_SERVICES = [
  { name: "Primera consulta", duration_minutes: 30 },
  { name: "Revisión", duration_minutes: 20 },
  { name: "Seguimiento", duration_minutes: 30 },
];

const DEFAULT_HOURS = [
  { day_of_week: 1, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 2, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 3, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 4, start_time: "09:00", end_time: "18:00", active: true },
  { day_of_week: 5, start_time: "09:00", end_time: "18:00", active: true },
];

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function findUniqueSlug(base: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("clinics")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();

  if (!data) return base;

  const suffix = Math.random().toString(36).slice(2, 6);
  const candidate = `${base.slice(0, 35)}-${suffix}`;

  const { data: existing } = await supabaseAdmin
    .from("clinics")
    .select("slug")
    .eq("slug", candidate)
    .maybeSingle();

  return existing ? `${base.slice(0, 31)}-${Date.now().toString(36)}` : candidate;
}

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  clinicName?: unknown;
};

export async function POST(request: NextRequest) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const clinicName = typeof body.clinicName === "string" ? body.clinicName.trim() : "";

  if (!email || !password || !clinicName) {
    return NextResponse.json(
      { error: "email, password y clinicName son requeridos" },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres" },
      { status: 400 },
    );
  }

  // Crear usuario en Supabase Auth con email confirmado (sin requerir confirmación por email)
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (userError || !userData.user) {
    const msg = userError?.message ?? "No se pudo crear el usuario";
    const isAlreadyExists =
      msg.toLowerCase().includes("already been registered") ||
      msg.toLowerCase().includes("already registered") ||
      msg.toLowerCase().includes("user already exists") ||
      msg.toLowerCase().includes("already exists");
    return NextResponse.json(
      { error: isAlreadyExists ? "Ya existe una cuenta con ese email" : msg },
      { status: isAlreadyExists ? 409 : 400 },
    );
  }

  const userId = userData.user.id;

  try {
    const baseSlug =
      toSlug(clinicName) || toSlug(email.split("@")[0]) || "clinica";
    const slug = await findUniqueSlug(baseSlug);

    const clinic = await createClinic({
      slug,
      name: clinicName,
      description: null,
      address: null,
      phone: null,
      theme_color: "#0e9e82",
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

    await supabaseAdmin.from("clinic_users").insert({
      clinic_id: clinic.id,
      user_id: userId,
      role: "owner",
    });

    await Promise.all([
      ...DEFAULT_SERVICES.map((s) =>
        createService({
          clinic_slug: clinic.slug,
          name: s.name,
          duration_minutes: s.duration_minutes,
          active: true,
        }),
      ),
      ...DEFAULT_HOURS.map((h) =>
        upsertClinicHour({
          clinic_slug: clinic.slug,
          day_of_week: h.day_of_week,
          start_time: h.start_time,
          end_time: h.end_time,
          active: h.active,
        }),
      ),
    ]);

    return NextResponse.json({ ok: true, clinicSlug: clinic.slug }, { status: 201 });
  } catch (error) {
    // Rollback: eliminar el usuario de auth que acabamos de crear
    await supabaseAdmin.auth.admin.deleteUser(userId);
    const msg =
      error instanceof Error ? error.message : "No se pudo crear la clínica";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
