import { createClinic, TRIAL_DAYS } from "@/lib/clinics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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

/**
 * Callback que procesa el link del email de confirmación.
 *
 * Flujo:
 *  1. Lee ?token_hash=...&type=signup de la URL.
 *  2. Llama a supabase.auth.verifyOtp — esto setea email_confirmed_at y
 *     crea la sesión en cookies.
 *  3. Lee user_metadata (clinic_name, dpa_*) del user confirmado.
 *  4. Si el user no tiene clínica asociada aún → crea clinics +
 *     clinic_users + aplica DPA. Idempotente: si ya tiene, salta.
 *  5. Redirige a /clinic/<slug>.
 *
 * Si algo falla → redirige a /verify-email con ?error=... para que el
 * frontend muestre mensaje y permita reenviar / contactar soporte.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") as EmailOtpType | null) ?? null;

  if (!tokenHash || type !== "signup") {
    const redirect = url.clone();
    redirect.pathname = "/verify-email";
    redirect.search = "?error=invalid_link";
    return NextResponse.redirect(redirect);
  }

  const supabase = await createSupabaseServerClient();

  // verifyOtp marca email_confirmed_at y crea sesión (cookies).
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    type: "signup",
    token_hash: tokenHash,
  });

  if (verifyError || !verifyData.user) {
    const redirect = url.clone();
    redirect.pathname = "/verify-email";
    redirect.search = `?error=${encodeURIComponent(verifyError?.message ?? "verify_failed")}`;
    return NextResponse.redirect(redirect);
  }

  const user = verifyData.user;
  const metadata = (user.user_metadata ?? {}) as {
    clinic_name?: string;
    dpa_accepted?: boolean;
    dpa_version?: string | null;
    dpa_ip?: string | null;
    clinic_provisioned?: boolean;
  };

  // Idempotencia: ¿ya tiene clínica este user? (por ejemplo, si hace click
  // dos veces en el link, o si ya llegó aquí antes)
  const { data: existingMembership } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, clinics:clinic_id(slug)")
    .eq("user_id", user.id)
    .maybeSingle<{ clinic_id: string; clinics: { slug: string } | null }>();

  if (existingMembership?.clinics?.slug) {
    const redirect = url.clone();
    redirect.pathname = `/clinic/${existingMembership.clinics.slug}`;
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  const clinicName = metadata.clinic_name?.trim() || "Mi clínica";
  const emailLocalPart = user.email?.split("@")[0] ?? "clinica";
  const baseSlug = toSlug(clinicName) || toSlug(emailLocalPart) || "clinica";
  const slug = await findUniqueSlug(baseSlug);

  const trialEndsAt = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
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
      plan: "starter",
      subscription_status: "trial",
      trial_ends_at: trialEndsAt,
    });

    await supabaseAdmin.from("clinic_users").insert({
      clinic_id: clinic.id,
      user_id: user.id,
      role: "owner",
    });

    if (metadata.dpa_accepted) {
      await supabaseAdmin
        .from("clinics")
        .update({
          dpa_accepted_at: new Date().toISOString(),
          dpa_version: metadata.dpa_version ?? "v1.4",
          dpa_ip: metadata.dpa_ip ?? null,
        })
        .eq("id", clinic.id);
    }

    // Marcar la metadata para evitar re-provisioning si algo vuelve aquí
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...metadata,
        clinic_provisioned: true,
      },
    });

    const redirect = url.clone();
    redirect.pathname = `/clinic/${clinic.slug}`;
    redirect.search = "";
    return NextResponse.redirect(redirect);
  } catch (error) {
    console.error("[auth/confirm] clinic provisioning failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    const redirect = url.clone();
    redirect.pathname = "/verify-email";
    redirect.search = "?error=provisioning_failed";
    return NextResponse.redirect(redirect);
  }
}
