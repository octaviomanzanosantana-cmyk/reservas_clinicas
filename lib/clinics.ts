import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClinicRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  theme_color: string | null;
  booking_enabled: boolean;
  google_connected: boolean;
  google_email: string | null;
  google_refresh_token: string | null;
  google_calendar_id: string | null;
  google_token_scope: string | null;
  google_token_type: string | null;
  google_token_expires_at: string | null;
  notification_email: string | null;
  review_url: string | null;
  reminder_hours: number;
  offers_presencial: boolean;
  offers_online: boolean;
  logo_has_dark_bg: boolean;
  timezone: string;
  is_demo: boolean;
  cancel_hours_limit: number;
  dpa_accepted_at: string | null;
  dpa_version: string | null;
  dpa_ip: string | null;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
  notify_on_new_appointment: boolean;
  notify_on_whatsapp_reminder: boolean;
  subscription_status: "trial" | "active" | "past_due" | "canceled" | "free";
  trial_ends_at: string | null;
  canceled_at: string | null;
  pending_plan_change: "free" | "starter" | "pro" | "business" | "enterprise" | null;
  pending_plan_change_at: string | null;
  holded_contact_id: string | null;
};

/**
 * Devuelve el email al que enviar copia de emails transaccionales
 * (confirmación, reprogramación, cancelación), o null si la clínica
 * tiene notify_on_new_appointment desactivado o no tiene email.
 *
 * Centraliza el gate para que todos los callers usen la misma regla.
 */
export function resolveClinicCopyEmail(clinic: {
  notification_email: string | null;
  notify_on_new_appointment: boolean;
} | null | undefined): string | null {
  if (!clinic) return null;
  if (!clinic.notify_on_new_appointment) return null;
  const email = clinic.notification_email?.trim();
  return email ? email : null;
}

export async function getClinicBySlug(slug: string): Promise<ClinicRow | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .eq("slug", safeSlug)
    .maybeSingle<ClinicRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function getClinicById(id: string): Promise<ClinicRow | null> {
  const safeId = id.trim();
  if (!safeId) return null;

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .eq("id", safeId)
    .maybeSingle<ClinicRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

export async function listClinics(): Promise<ClinicRow[]> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function listDemoClinics(): Promise<ClinicRow[]> {
  const { data, error } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .eq("is_demo", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function deleteClinicById(id: string): Promise<void> {
  const safeId = id.trim();
  if (!safeId) return;

  // clinic_users tiene ON DELETE CASCADE desde clinics
  // appointments, services, clinic_hours usan clinic_slug, no FK cascade
  // Borramos manualmente primero
  const clinic = await getClinicById(safeId);
  if (!clinic) return;

  await supabaseAdmin.from("appointments").delete().eq("clinic_id", safeId);
  await supabaseAdmin.from("services").delete().eq("clinic_slug", clinic.slug);
  await supabaseAdmin.from("clinic_hours").delete().eq("clinic_slug", clinic.slug);
  // clinic_users se borra en cascade
  await supabaseAdmin.from("clinics").delete().eq("id", safeId);
}

export async function createClinic(
  input: Pick<
    ClinicRow,
    | "slug"
    | "name"
    | "description"
    | "address"
    | "phone"
    | "theme_color"
    | "booking_enabled"
    | "google_connected"
    | "google_email"
    | "google_refresh_token"
    | "google_calendar_id"
    | "google_token_scope"
    | "google_token_type"
    | "google_token_expires_at"
  > & {
    logo_url?: string | null;
  },
): Promise<ClinicRow> {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .insert({
      slug,
      name,
      description: input.description?.trim() || null,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      theme_color: input.theme_color?.trim() || null,
      booking_enabled: input.booking_enabled,
      google_connected: input.google_connected,
      google_email: input.google_email?.trim() || null,
      google_refresh_token: input.google_refresh_token?.trim() || null,
      google_calendar_id: input.google_calendar_id?.trim() || null,
      google_token_scope: input.google_token_scope?.trim() || null,
      google_token_type: input.google_token_type?.trim() || null,
      google_token_expires_at: input.google_token_expires_at?.trim() || null,
    })
    .select("*")
    .single<ClinicRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la clínica");
  }

  return data;
}

export async function updateClinicBySlug(
  slug: string,
  input: Partial<
    Pick<
      ClinicRow,
      | "name"
      | "description"
      | "address"
      | "phone"
      | "logo_url"
      | "theme_color"
      | "booking_enabled"
      | "google_connected"
      | "google_email"
      | "google_refresh_token"
      | "google_calendar_id"
      | "google_token_scope"
      | "google_token_type"
      | "google_token_expires_at"
      | "notification_email"
      | "review_url"
      | "reminder_hours"
      | "offers_presencial"
      | "offers_online"
      | "logo_has_dark_bg"
      | "timezone"
      | "notify_on_new_appointment"
      | "notify_on_whatsapp_reminder"
    >
  >,
): Promise<ClinicRow | null> {
  const safeSlug = slug.trim();
  if (!safeSlug) return null;

  const payload = {
    ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
    ...(typeof input.description === "string"
      ? { description: input.description.trim() || null }
      : input.description === null
        ? { description: null }
        : {}),
    ...(typeof input.address === "string"
      ? { address: input.address.trim() || null }
      : input.address === null
        ? { address: null }
        : {}),
    ...(typeof input.phone === "string"
      ? { phone: input.phone.trim() || null }
      : input.phone === null
        ? { phone: null }
        : {}),
    ...(typeof input.logo_url === "string"
      ? { logo_url: input.logo_url.trim() || null }
      : input.logo_url === null
        ? { logo_url: null }
        : {}),
    ...(typeof input.theme_color === "string"
      ? { theme_color: input.theme_color.trim() || null }
      : input.theme_color === null
        ? { theme_color: null }
        : {}),
    ...(typeof input.booking_enabled === "boolean"
      ? { booking_enabled: input.booking_enabled }
      : {}),
    ...(typeof input.google_connected === "boolean"
      ? { google_connected: input.google_connected }
      : {}),
    ...(typeof input.google_email === "string"
      ? { google_email: input.google_email.trim() || null }
      : input.google_email === null
        ? { google_email: null }
        : {}),
    ...(typeof input.google_refresh_token === "string"
      ? { google_refresh_token: input.google_refresh_token.trim() || null }
      : input.google_refresh_token === null
        ? { google_refresh_token: null }
        : {}),
    ...(typeof input.google_calendar_id === "string"
      ? { google_calendar_id: input.google_calendar_id.trim() || null }
      : input.google_calendar_id === null
        ? { google_calendar_id: null }
        : {}),
    ...(typeof input.google_token_scope === "string"
      ? { google_token_scope: input.google_token_scope.trim() || null }
      : input.google_token_scope === null
        ? { google_token_scope: null }
        : {}),
    ...(typeof input.google_token_type === "string"
      ? { google_token_type: input.google_token_type.trim() || null }
      : input.google_token_type === null
        ? { google_token_type: null }
        : {}),
    ...(typeof input.google_token_expires_at === "string"
      ? { google_token_expires_at: input.google_token_expires_at.trim() || null }
      : input.google_token_expires_at === null
        ? { google_token_expires_at: null }
        : {}),
    ...(typeof input.notification_email === "string"
      ? { notification_email: input.notification_email.trim() || null }
      : input.notification_email === null
        ? { notification_email: null }
        : {}),
    ...(typeof input.review_url === "string"
      ? { review_url: input.review_url.trim() || null }
      : input.review_url === null
        ? { review_url: null }
        : {}),
    ...(typeof input.reminder_hours === "number"
      ? { reminder_hours: input.reminder_hours }
      : {}),
    ...(typeof input.offers_presencial === "boolean"
      ? { offers_presencial: input.offers_presencial }
      : {}),
    ...(typeof input.offers_online === "boolean"
      ? { offers_online: input.offers_online }
      : {}),
    ...(typeof input.logo_has_dark_bg === "boolean"
      ? { logo_has_dark_bg: input.logo_has_dark_bg }
      : {}),
    ...(typeof input.timezone === "string"
      ? { timezone: input.timezone.trim() || "Atlantic/Canary" }
      : {}),
    ...(typeof input.notify_on_new_appointment === "boolean"
      ? { notify_on_new_appointment: input.notify_on_new_appointment }
      : {}),
    ...(typeof input.notify_on_whatsapp_reminder === "boolean"
      ? { notify_on_whatsapp_reminder: input.notify_on_whatsapp_reminder }
      : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("clinics")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", safeSlug)
    .select("*")
    .maybeSingle<ClinicRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}
